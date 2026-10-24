import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Job } from "bullmq";
import sharp from "sharp";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { s3 } from "../lib/s3.js";
import type { ImageProcessingJob } from "../queues/image-processing.js";

const variants = [
  { kind: "THUMBNAIL" as const, maxSize: 480, quality: 78 },
  { kind: "PREVIEW" as const, maxSize: 1_920, quality: 84 },
];

export async function processImage(job: Job<ImageProcessingJob>) {
  const image = await prisma.image.findUnique({ where: { id: job.data.imageId } });

  if (!image) {
    throw new Error(`Image ${job.data.imageId} no longer exists`);
  }

  await prisma.image.update({
    where: { id: image.id },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    const sourceObject = await s3.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: image.objectKey }),
    );

    if (!sourceObject.Body) {
      throw new Error(`Object ${image.objectKey} has no body`);
    }

    const sourceBuffer = Buffer.from(await sourceObject.Body.transformToByteArray());
    const sourceMetadata = await sharp(sourceBuffer).metadata();
    const normalized = await sharp(sourceBuffer).rotate().toBuffer({ resolveWithObject: true });

    if (!normalized.info.width || !normalized.info.height) {
      throw new Error("Sharp could not determine image dimensions");
    }

    for (const variant of variants) {
      const output = await sharp(normalized.data)
        .resize({
          width: variant.maxSize,
          height: variant.maxSize,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: variant.quality })
        .toBuffer({ resolveWithObject: true });
      const objectKey = `images/${image.id}/variants/${variant.kind.toLowerCase()}.webp`;

      await s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: objectKey,
          Body: output.data,
          ContentType: "image/webp",
          ContentLength: output.data.byteLength,
          Metadata: { source: image.objectKey, variant: variant.kind.toLowerCase() },
        }),
      );

      await prisma.imageVariant.upsert({
        where: { imageId_kind: { imageId: image.id, kind: variant.kind } },
        create: {
          imageId: image.id,
          kind: variant.kind,
          objectKey,
          mimeType: "image/webp",
          byteSize: BigInt(output.data.byteLength),
          width: output.info.width,
          height: output.info.height,
        },
        update: {
          objectKey,
          mimeType: "image/webp",
          byteSize: BigInt(output.data.byteLength),
          width: output.info.width,
          height: output.info.height,
        },
      });
    }

    const tagLabels = createTechnicalTags({
      width: normalized.info.width,
      height: normalized.info.height,
      format: sourceMetadata.format,
    });

    await prisma.$transaction(async (transaction) => {
      for (const label of tagLabels) {
        const tag = await transaction.tag.upsert({
          where: { slug: label.slug },
          create: label,
          update: { name: label.name, category: label.category },
        });
        await transaction.imageTag.upsert({
          where: { imageId_tagId: { imageId: image.id, tagId: tag.id } },
          create: { imageId: image.id, tagId: tag.id },
          update: {},
        });
      }

      await transaction.image.update({
        where: { id: image.id },
        data: {
          width: normalized.info.width,
          height: normalized.info.height,
          byteSize: BigInt(sourceBuffer.byteLength),
          metadata: {
            format: sourceMetadata.format ?? null,
            space: sourceMetadata.space ?? null,
            channels: sourceMetadata.channels,
            density: sourceMetadata.density ?? null,
            hasAlpha: sourceMetadata.hasAlpha,
            orientation: sourceMetadata.orientation ?? null,
          },
          status: "READY",
          errorMessage: null,
        },
      });
    });

    return { imageId: image.id, variants: variants.length, tags: tagLabels.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    await prisma.image.update({
      where: { id: image.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 2_000) },
    });
    throw error;
  }
}

function createTechnicalTags(input: { width: number; height: number; format?: string }) {
  const ratio = input.width / input.height;
  const orientation =
    ratio > 1.05
      ? { name: "Querformat", slug: "querformat", category: "TECHNICAL" as const }
      : ratio < 0.95
        ? { name: "Hochformat", slug: "hochformat", category: "TECHNICAL" as const }
        : { name: "Quadratisch", slug: "quadratisch", category: "TECHNICAL" as const };
  const format = input.format
    ? {
        name: input.format.toUpperCase(),
        slug: `format-${input.format.toLowerCase()}`,
        category: "TECHNICAL" as const,
      }
    : null;

  return format ? [orientation, format] : [orientation];
}
