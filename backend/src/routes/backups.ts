import { ZipArchive, type ArchiverError } from "archiver";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { Router } from "express";
import unzipper, { type Entry } from "unzipper";
import { z } from "zod";
import { requirePermission } from "../auth/middleware.js";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";
import { s3 } from "../lib/s3.js";
import { enqueueImageProcessing } from "../queues/image-processing.js";

const supportedMimeTypes = ["image/avif", "image/jpeg", "image/png", "image/webp"] as const;
const tagCategories = ["ROOM", "FURNITURE", "MATERIAL", "COLOR", "STYLE", "FEATURE", "TECHNICAL"] as const;
const maxManifestBytes = 25 * 1024 * 1024;

const manifestSchema = z.object({
  format: z.literal("moebel-design-suite-image-catalog"),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  sourceTenant: z.object({ id: z.string().uuid(), name: z.string().max(300) }),
  images: z.array(z.object({
    originalName: z.string().min(1).max(255),
    title: z.string().max(160).nullable(),
    description: z.string().max(2_000).nullable(),
    mimeType: z.enum(supportedMimeTypes),
    byteSize: z.string().regex(/^\d+$/),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    file: z.string().regex(/^files\/[a-f0-9]{64}\.(?:jpg|png|webp|avif)$/),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    metadata: z.unknown().nullable(),
    sourceVisibility: z.enum(["PRIVATE", "RESTRICTED", "PUBLIC"]),
    createdAt: z.iso.datetime(),
    tags: z.array(z.object({
      name: z.string().min(1).max(80),
      slug: z.string().min(1).max(100),
      category: z.enum(tagCategories),
    })).max(30),
  })),
});

type BackupManifest = z.infer<typeof manifestSchema>;
type ManifestImage = BackupManifest["images"][number];

export const backupsRouter = Router();

backupsRouter.get("/export", requirePermission("manageCompanySettings"), async (request, response) => {
  const { tenant } = request.auth!.user;
  const sourceImages = await prisma.image.findMany({
    where: {
      ownerTenantId: tenant.id,
      status: { not: "PENDING_UPLOAD" },
    },
    orderBy: { createdAt: "asc" },
    include: { tags: { include: { tag: true } } },
  });

  if (sourceImages.length > env.MAX_BACKUP_IMAGES) {
    throw new AppError(413, `Der Katalog enthält mehr als ${env.MAX_BACKUP_IMAGES} Bilder`);
  }

  const images: ManifestImage[] = [];
  const objectKeyByHash = new Map<string, string>();
  for (const image of sourceImages) {
    let contentHash = image.contentHash;
    let byteSize = image.byteSize;
    if (!contentHash || byteSize === null) {
      const object = await hashStoredObject(image.objectKey);
      contentHash = object.hash;
      byteSize = BigInt(object.bytes);
      await prisma.image.update({
        where: { id: image.id },
        data: { contentHash, byteSize },
      });
    }

    images.push({
      originalName: image.originalName,
      title: image.title,
      description: image.description,
      mimeType: image.mimeType as ManifestImage["mimeType"],
      byteSize: byteSize.toString(),
      contentHash,
      file: `files/${contentHash}.${extensionForMime(image.mimeType)}`,
      width: image.width,
      height: image.height,
      metadata: image.metadata ?? null,
      sourceVisibility: image.visibility,
      createdAt: image.createdAt.toISOString(),
      tags: image.tags.map(({ tag }) => ({ name: tag.name, slug: tag.slug, category: tag.category })),
    });
    if (!objectKeyByHash.has(contentHash)) objectKeyByHash.set(contentHash, image.objectKey);
  }

  const manifest: BackupManifest = {
    format: "moebel-design-suite-image-catalog",
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceTenant: { id: tenant.id, name: tenant.name },
    images,
  };
  const safeTenant = tenant.slug.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "tenant";
  const date = new Date().toISOString().slice(0, 10);

  response.status(200);
  response.setHeader("content-type", "application/zip");
  response.setHeader("content-disposition", `attachment; filename="${safeTenant}-bilder-${date}.mds-backup.zip"`);
  response.setHeader("cache-control", "no-store");

  const archive = new ZipArchive({ store: true, forceZip64: true });
  archive.on("warning", (error: ArchiverError) => {
    if (error.code !== "ENOENT") archive.emit("error", error);
  });
  archive.pipe(response);
  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

  const appendedFiles = new Set<string>();
  for (const image of images) {
    if (appendedFiles.has(image.file)) continue;
    appendedFiles.add(image.file);
    const objectKey = objectKeyByHash.get(image.contentHash);
    if (!objectKey) throw new AppError(500, `Quelldatei für ${image.originalName} fehlt`);
    archive.append(streamStoredObject(objectKey), { name: image.file, store: true });
  }

  await archive.finalize();
});

backupsRouter.post("/import", requirePermission("manageCompanySettings"), async (request, response) => {
  if (!request.is("application/zip") && !request.is("application/octet-stream")) {
    throw new AppError(415, "Bitte eine .mds-backup.zip-Datei auswählen");
  }
  const contentLength = Number(request.get("content-length") ?? 0);
  if (contentLength > env.MAX_BACKUP_BYTES) {
    throw new AppError(413, "Das Backup überschreitet die zulässige Größe");
  }

  const tenantId = request.auth!.user.tenant.id;
  const userId = request.auth!.user.id;
  const created: Array<{ id: string; objectKey: string }> = [];
  let manifest: BackupManifest | null = null;
  let importByFile = new Map<string, ManifestImage>();
  let existingHashes = new Set<string>();
  let preexistingHashes = new Set<string>();
  let seenUncompressedBytes = 0;
  let imported = 0;
  let skippedDuplicates = 0;
  let missingTagLinks = 0;
  const processedFiles = new Set<string>();

  let compressedBytes = 0;
  const byteLimiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      compressedBytes += chunk.length;
      if (compressedBytes > env.MAX_BACKUP_BYTES) {
        callback(new AppError(413, "Das Backup überschreitet die zulässige Größe"));
        return;
      }
      callback(null, chunk);
    },
  });
  const parser = unzipper.Parse({ forceStream: true });
  let transportError: Error | null = null;
  const failTransport = (error: Error) => {
    transportError = error;
    if (!parser.destroyed) parser.destroy(error);
  };
  request.on("error", failTransport);
  byteLimiter.on("error", failTransport);
  request.pipe(byteLimiter).pipe(parser);

  try {
    for await (const rawEntry of parser) {
      const entry = rawEntry as Entry;
      if (entry.type !== "File") {
        entry.autodrain();
        continue;
      }

      const uncompressedSize = entryUncompressedSize(entry);
      seenUncompressedBytes += uncompressedSize;
      if (seenUncompressedBytes > env.MAX_BACKUP_BYTES) {
        entry.autodrain();
        throw new AppError(413, "Der entpackte Katalog überschreitet die zulässige Größe");
      }

      if (!manifest) {
        if (entry.path !== "manifest.json") {
          entry.autodrain();
          throw new AppError(400, "Ungültiges Backup: manifest.json muss der erste Eintrag sein");
        }
        if (uncompressedSize > maxManifestBytes) {
          entry.autodrain();
          throw new AppError(413, "Das Backup-Manifest ist zu groß");
        }
        manifest = manifestSchema.parse(JSON.parse((await readBoundedEntry(entry, maxManifestBytes)).toString("utf8")));
        if (manifest.images.length > env.MAX_BACKUP_IMAGES) {
          throw new AppError(413, `Das Backup enthält mehr als ${env.MAX_BACKUP_IMAGES} Bilder`);
        }
        for (const image of manifest.images) {
          const expectedFile = `files/${image.contentHash}.${extensionForMime(image.mimeType)}`;
          if (image.file !== expectedFile) throw new AppError(400, `Ungültiger Dateipfad für ${image.originalName}`);
        }
        importByFile = uniqueImagesByFile(manifest.images);
        preexistingHashes = await tenantContentHashes(tenantId);
        existingHashes = new Set(preexistingHashes);
        skippedDuplicates = manifest.images.length - importByFile.size
          + [...importByFile.values()].filter((image) => existingHashes.has(image.contentHash)).length;
        continue;
      }

      const image = importByFile.get(entry.path);
      if (!image) {
        entry.autodrain();
        throw new AppError(400, `Unerwartete Datei im Backup: ${entry.path}`);
      }
      if (processedFiles.has(entry.path)) {
        entry.autodrain();
        throw new AppError(400, `Doppelter Archiveintrag: ${entry.path}`);
      }
      if (BigInt(image.byteSize) > BigInt(env.MAX_UPLOAD_BYTES)) {
        entry.autodrain();
        throw new AppError(413, `${image.originalName} überschreitet die zulässige Bildgröße`);
      }
      if (uncompressedSize > 0 && BigInt(uncompressedSize) !== BigInt(image.byteSize)) {
        entry.autodrain();
        throw new AppError(400, `Die Dateigröße von ${image.originalName} stimmt nicht mit dem Manifest überein`);
      }
      if (existingHashes.has(image.contentHash)) {
        await consumeEntry(entry, Number(image.byteSize));
        processedFiles.add(entry.path);
        continue;
      }

      const id = randomUUID();
      const objectKey = `images/${id}/original/${sanitizeFilename(image.originalName)}`;
      const hash = createHash("sha256");
      let bytes = 0;
      const body = Readable.from((async function* () {
        for await (const chunk of entry) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
          hash.update(buffer);
          bytes += buffer.length;
          if (bytes > Number(image.byteSize)) {
            throw new AppError(400, `Die Bilddatei ${image.originalName} ist größer als im Manifest angegeben`);
          }
          yield buffer;
        }
      })());

      await s3.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: image.mimeType,
        ContentLength: Number(image.byteSize),
      }));

      const actualHash = hash.digest("hex");
      if (actualHash !== image.contentHash || BigInt(bytes) !== BigInt(image.byteSize)) {
        await deleteObjectKeys([objectKey]);
        throw new AppError(400, `Die Prüfsumme von ${image.originalName} ist ungültig`);
      }

      const tagIds: string[] = [];
      for (const archivedTag of image.tags) {
        const normalizedName = normalizeTag(archivedTag.name);
        const tag = await prisma.tag.findFirst({
          where: {
            category: archivedTag.category,
            OR: [
              { slug: archivedTag.slug },
              { normalizedName },
              { aliases: { some: { normalizedName } } },
            ],
          },
          select: { id: true },
        });
        if (tag) tagIds.push(tag.id);
        else missingTagLinks += 1;
      }

      let recordCreated = false;
      try {
        recordCreated = await prisma.$transaction(async (transaction) => {
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${image.contentHash}))`;
          const duplicate = await transaction.image.findFirst({
            where: { ownerTenantId: tenantId, contentHash: image.contentHash },
            select: { id: true },
          });
          if (duplicate) return false;
          await transaction.image.create({
            data: {
              id,
              objectKey,
              originalName: image.originalName,
              title: image.title,
              description: image.description,
              mimeType: image.mimeType,
              byteSize: BigInt(image.byteSize),
              contentHash: image.contentHash,
              width: image.width,
              height: image.height,
              ...(image.metadata !== null ? { metadata: image.metadata as Prisma.InputJsonValue } : {}),
              status: "QUEUED",
              visibility: "PRIVATE",
              ownerTenantId: tenantId,
              ownerUserId: userId,
              createdAt: new Date(image.createdAt),
              tags: { create: [...new Set(tagIds)].map((tagId) => ({ tagId })) },
            },
          });
          return true;
        });
      } catch (error) {
        await deleteObjectKeys([objectKey]);
        throw error;
      }

      if (!recordCreated) {
        await deleteObjectKeys([objectKey]);
        existingHashes.add(image.contentHash);
        processedFiles.add(entry.path);
        skippedDuplicates += 1;
        continue;
      }

      created.push({ id, objectKey });
      existingHashes.add(image.contentHash);
      processedFiles.add(entry.path);
      imported += 1;
    }

    if (transportError) throw transportError;

    if (!manifest) throw new AppError(400, "Ungültiges Backup: manifest.json fehlt");
    const requiredFiles = [...importByFile.values()]
      .filter((image) => !preexistingHashes.has(image.contentHash))
      .map((image) => image.file);
    const missingFiles = requiredFiles.filter((file) => !processedFiles.has(file));
    if (missingFiles.length) throw new AppError(400, `Im Backup fehlen ${missingFiles.length} Bilddateien`);

    for (const image of created) {
      try {
        await enqueueImageProcessing(image.id);
      } catch (error) {
        await prisma.image.update({
          where: { id: image.id },
          data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Verarbeitung konnte nicht gestartet werden" },
        });
      }
    }

    response.status(201).json({
      imported,
      skippedDuplicates,
      missingTagLinks,
      total: manifest.images.length,
      sourceTenant: manifest.sourceTenant,
    });
  } catch (error) {
    if (!parser.destroyed) {
      parser.destroy(error instanceof Error ? error : new Error("Backup-Import abgebrochen"));
    }
    if (created.length) {
      await prisma.image.deleteMany({ where: { id: { in: created.map((image) => image.id) } } }).catch(() => undefined);
      await deleteObjectKeys(created.map((image) => image.objectKey)).catch(() => undefined);
    }
    throw error;
  }
});

async function hashStoredObject(objectKey: string) {
  const object = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
  if (!object.Body) throw new AppError(500, `Gespeicherte Bilddatei ${objectKey} fehlt`);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
    bytes += chunk.byteLength;
  }
  return { hash: hash.digest("hex"), bytes };
}

function streamStoredObject(objectKey: string) {
  return Readable.from((async function* () {
    const object = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
    if (!object.Body) throw new AppError(500, `Gespeicherte Bilddatei ${objectKey} fehlt`);
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) yield chunk;
  })());
}

async function tenantContentHashes(tenantId: string) {
  const images = await prisma.image.findMany({
    where: { ownerTenantId: tenantId, status: { not: "PENDING_UPLOAD" } },
    select: { id: true, objectKey: true, contentHash: true },
  });
  const hashes = new Set<string>();
  for (const image of images) {
    let hash = image.contentHash;
    if (!hash) {
      const object = await hashStoredObject(image.objectKey);
      hash = object.hash;
      await prisma.image.update({ where: { id: image.id }, data: { contentHash: hash, byteSize: BigInt(object.bytes) } });
    }
    hashes.add(hash);
  }
  return hashes;
}

function uniqueImagesByFile(images: ManifestImage[]) {
  const result = new Map<string, ManifestImage>();
  for (const image of images) {
    if (!result.has(image.file)) result.set(image.file, image);
  }
  return result;
}

function entryUncompressedSize(entry: Entry) {
  return (entry as Entry & { vars?: { uncompressedSize?: number } }).vars?.uncompressedSize
    ?? entry.extra?.uncompressedSize
    ?? 0;
}

async function readBoundedEntry(entry: Entry, maximumBytes: number) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of entry) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > maximumBytes) throw new AppError(413, "Ein Archiveintrag überschreitet die zulässige Größe");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, bytes);
}

async function consumeEntry(entry: Entry, expectedBytes: number) {
  let bytes = 0;
  for await (const chunk of entry) {
    bytes += Buffer.isBuffer(chunk) ? chunk.length : (chunk as Uint8Array).byteLength;
    if (bytes > expectedBytes) throw new AppError(400, "Ein Archiveintrag ist größer als im Manifest angegeben");
  }
  if (bytes !== expectedBytes) throw new AppError(400, "Eine Bilddatei stimmt nicht mit der Größe im Manifest überein");
}

function extensionForMime(mimeType: string) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as Record<string, string>)[mimeType] ?? "jpg";
}

function sanitizeFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(0, 180) || "image";
}

function normalizeTag(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function deleteObjectKeys(keys: string[]) {
  for (let index = 0; index < keys.length; index += 1_000) {
    await s3.send(new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: { Objects: keys.slice(index, index + 1_000).map((Key) => ({ Key })), Quiet: true },
    }));
  }
}
