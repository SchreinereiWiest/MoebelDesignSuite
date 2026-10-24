import { DeleteObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import type { Prisma } from "../generated/prisma/client.ts";
import { AppError } from "../lib/errors.js";
import { createDownloadUrl, createUploadUrl, s3 } from "../lib/s3.js";
import { enqueueImageProcessing } from "../queues/image-processing.js";

const supportedMimeTypes = [
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(supportedMimeTypes),
  size: z.number().int().positive().max(env.MAX_UPLOAD_BYTES),
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2_000).optional(),
  visibility: z.enum(["PRIVATE", "RESTRICTED", "PUBLIC"]).default("PRIVATE"),
  tags: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        category: z
          .enum(["ROOM", "FURNITURE", "MATERIAL", "COLOR", "STYLE", "FEATURE"])
          .default("FEATURE"),
      }),
    )
    .max(30)
    .default([]),
});

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
  search: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(80).optional(),
  tags: z.string().trim().max(500).optional(),
  match: z.enum(["all", "any"]).default("all"),
  visibility: z.enum(["PRIVATE", "RESTRICTED", "PUBLIC"]).optional(),
  status: z.enum(["PENDING_UPLOAD", "QUEUED", "PROCESSING", "READY", "FAILED"]).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  visibility: z.enum(["PRIVATE", "RESTRICTED", "PUBLIC"]).optional(),
  tags: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        category: z.enum([
          "ROOM",
          "FURNITURE",
          "MATERIAL",
          "COLOR",
          "STYLE",
          "FEATURE",
          "TECHNICAL",
        ]),
      }),
    )
    .max(30)
    .optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

export const imagesRouter = Router();

imagesRouter.post("/presign", async (request, response) => {
  const input = uploadSchema.parse(request.body);
  const id = crypto.randomUUID();
  const safeFilename = sanitizeFilename(input.filename);
  const objectKey = `images/${id}/original/${safeFilename}`;

  const image = await prisma.image.create({
    data: {
      id,
      objectKey,
      originalName: input.filename,
      title: input.title || null,
      description: input.description || null,
      mimeType: input.contentType,
      byteSize: BigInt(input.size),
      visibility: input.visibility,
    },
  });

  await replaceImageTags(image.id, input.tags);
  const uploadUrl = await createUploadUrl({
    objectKey,
    contentType: input.contentType,
  });

  response.status(201).json({
    imageId: image.id,
    objectKey,
    uploadUrl,
    expiresIn: env.S3_SIGNED_URL_TTL_SECONDS,
    headers: {
      "content-type": input.contentType,
    },
  });
});

imagesRouter.post("/:id/complete", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  const image = await prisma.image.findUnique({ where: { id } });

  if (!image) {
    throw new AppError(404, "Bild nicht gefunden");
  }

  const storedObject = await s3.send(
    new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: image.objectKey }),
  );

  if (
    storedObject.ContentLength === undefined ||
    storedObject.ContentLength > env.MAX_UPLOAD_BYTES ||
    BigInt(storedObject.ContentLength) !== image.byteSize
  ) {
    throw new AppError(400, "Die hochgeladene Dateigröße stimmt nicht mit der Anfrage überein");
  }

  await prisma.image.update({
    where: { id },
    data: {
      status: "QUEUED",
      byteSize: storedObject.ContentLength ?? image.byteSize,
      mimeType: storedObject.ContentType ?? image.mimeType,
      errorMessage: null,
    },
  });
  const job = await enqueueImageProcessing(id);

  response.status(202).json({ imageId: id, jobId: job.id, status: "QUEUED" });
});

imagesRouter.get("/", async (request, response) => {
  const query = listSchema.parse(request.query);
  const filters: Prisma.ImageWhereInput[] = [];

  if (query.search) {
    filters.push({
      OR: [
        { originalName: { contains: query.search, mode: "insensitive" } },
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }
  if (query.status) {
    filters.push({ status: query.status });
  }
  if (query.tag) {
    filters.push({ tags: { some: { tag: { slug: query.tag } } } });
  }
  const tagSlugs = query.tags
    ? query.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  if (tagSlugs.length) {
    if (query.match === "all") {
      filters.push(...tagSlugs.map((slug) => ({ tags: { some: { tag: { slug } } } })));
    } else {
      filters.push({ tags: { some: { tag: { slug: { in: tagSlugs } } } } });
    }
  }
  if (query.visibility) {
    filters.push({ visibility: query.visibility });
  }

  const where: Prisma.ImageWhereInput = filters.length ? { AND: filters } : {};
  const [total, images] = await prisma.$transaction([
    prisma.image.count({ where }),
    prisma.image.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { variants: true, tags: { include: { tag: true } } },
    }),
  ]);

  const data = await Promise.all(
    images.map(async (image) => {
      const thumbnail = image.variants.find((variant) => variant.kind === "THUMBNAIL");
      return {
        id: image.id,
        filename: image.originalName,
        title: image.title,
        description: image.description,
        mimeType: image.mimeType,
        byteSize: image.byteSize?.toString() ?? null,
        width: image.width,
        height: image.height,
        status: image.status,
        visibility: image.visibility,
        createdAt: image.createdAt,
        tags: image.tags.map(({ tag }) => ({
          name: tag.name,
          slug: tag.slug,
          category: tag.category,
        })),
        thumbnailUrl: thumbnail ? await createDownloadUrl(thumbnail.objectKey) : null,
      };
    }),
  );

  response.json({ data, page: query.page, limit: query.limit, total });
});

imagesRouter.get("/:id", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  const image = await prisma.image.findUnique({
    where: { id },
    include: { variants: true, tags: { include: { tag: true } } },
  });

  if (!image) {
    throw new AppError(404, "Bild nicht gefunden");
  }

  const preview = image.variants.find((variant) => variant.kind === "PREVIEW");
  const thumbnail = image.variants.find((variant) => variant.kind === "THUMBNAIL");
  response.json({
    id: image.id,
    filename: image.originalName,
    title: image.title,
    description: image.description,
    mimeType: image.mimeType,
    byteSize: image.byteSize?.toString() ?? null,
    width: image.width,
    height: image.height,
    metadata: image.metadata,
    status: image.status,
    visibility: image.visibility,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
    tags: image.tags.map(({ tag }) => ({
      name: tag.name,
      slug: tag.slug,
      category: tag.category,
    })),
    imageUrl: await createDownloadUrl(preview?.objectKey ?? image.objectKey),
    thumbnailUrl: thumbnail ? await createDownloadUrl(thumbnail.objectKey) : null,
  });
});

imagesRouter.patch("/:id", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  const input = updateSchema.parse(request.body);
  const existing = await prisma.image.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Bild nicht gefunden");
  }

  await prisma.image.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title || null } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
    },
  });
  if (input.tags) {
    await replaceImageTags(id, input.tags);
  }

  response.json({ id, updated: true });
});

imagesRouter.delete("/:id", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  const image = await prisma.image.findUnique({ where: { id }, include: { variants: true } });

  if (!image) {
    throw new AppError(404, "Bild nicht gefunden");
  }

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: {
        Objects: [image.objectKey, ...image.variants.map((variant) => variant.objectKey)].map(
          (Key) => ({ Key }),
        ),
        Quiet: true,
      },
    }),
  );
  await prisma.image.delete({ where: { id } });
  response.status(204).send();
});

imagesRouter.get("/:id/url", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  const image = await prisma.image.findUnique({ where: { id } });

  if (!image) {
    throw new AppError(404, "Bild nicht gefunden");
  }

  response.json({
    url: await createDownloadUrl(image.objectKey),
    expiresIn: env.S3_SIGNED_URL_TTL_SECONDS,
  });
});

function sanitizeFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(0, 180) || "image";
}

async function replaceImageTags(
  imageId: string,
  tags: Array<{
    name: string;
    category: "ROOM" | "FURNITURE" | "MATERIAL" | "COLOR" | "STYLE" | "FEATURE" | "TECHNICAL";
  }>,
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.imageTag.deleteMany({ where: { imageId } });
    for (const input of tags) {
      const slug = slugify(input.name);
      const tag = await transaction.tag.upsert({
        where: { slug },
        create: { name: input.name, slug, category: input.category },
        update: { name: input.name, category: input.category },
      });
      await transaction.imageTag.create({ data: { imageId, tagId: tag.id } });
    }
  });
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
