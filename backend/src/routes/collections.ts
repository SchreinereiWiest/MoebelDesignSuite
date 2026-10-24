import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../lib/errors.js";
import { createDownloadUrl } from "../lib/s3.js";

const idSchema = z.object({ id: z.string().uuid() });
const itemIdSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });
const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
  search: z.string().trim().max(100).optional(),
});
const collectionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).nullable().optional(),
});
const collectionUpdateSchema = collectionSchema.partial();
const addItemSchema = z.object({ imageId: z.string().uuid() });
const updateItemSchema = z.object({
  sortOrder: z.number().int().min(0).optional(),
  x: z.number().min(0).max(4_000).nullable().optional(),
  y: z.number().min(0).max(4_000).nullable().optional(),
  width: z.number().min(120).max(1_200).nullable().optional(),
  height: z.number().min(80).max(1_200).nullable().optional(),
  rotation: z.number().min(-180).max(180).optional(),
  zIndex: z.number().int().min(0).max(10_000).optional(),
  note: z.string().trim().max(2_000).nullable().optional(),
  rating: z.enum(["LIKE", "DISLIKE"]).nullable().optional(),
});

export const collectionsRouter = Router();

collectionsRouter.get("/", async (request, response) => {
  const query = listSchema.parse(request.query);
  const owner = collectionOwner(request);
  const where = {
    ...owner,
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
  };
  const [total, collections] = await prisma.$transaction([
    prisma.collection.count({ where }),
    prisma.collection.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          take: 4,
          include: { image: { include: { variants: true } } },
        },
        _count: { select: { items: true } },
      },
    }),
  ]);

  response.json({
    data: await Promise.all(
      collections.map(async (collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        itemCount: collection._count.items,
        covers: await Promise.all(
          collection.items.map(async ({ image }) => {
            const thumbnail = image.variants.find((variant) => variant.kind === "THUMBNAIL");
            return {
              imageId: image.id,
              url: thumbnail ? await createDownloadUrl(thumbnail.objectKey) : null,
            };
          }),
        ),
      })),
    ),
    page: query.page,
    limit: query.limit,
    total,
  });
});

collectionsRouter.post("/", async (request, response) => {
  const input = collectionSchema.parse(request.body);
  const collection = await prisma.collection.create({
    data: {
      name: input.name,
      description: input.description || null,
      tenantId: request.auth!.user.tenant.id,
      userId: request.auth!.user.id,
    },
  });
  response.status(201).json(collection);
});

collectionsRouter.get("/:id", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  const collection = await prisma.collection.findFirst({
    where: { id, ...collectionOwner(request) },
    include: {
      items: {
        orderBy: [{ zIndex: "asc" }, { sortOrder: "asc" }],
        include: {
          image: { include: { variants: true, tags: { include: { tag: true } } } },
        },
      },
    },
  });

  if (!collection) {
    throw new AppError(404, "Moodboard nicht gefunden");
  }

  response.json({
    id: collection.id,
    name: collection.name,
    description: collection.description,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    items: await Promise.all(
      collection.items.map(async (item) => {
        const preview = item.image.variants.find((variant) => variant.kind === "PREVIEW");
        const thumbnail = item.image.variants.find((variant) => variant.kind === "THUMBNAIL");
        return {
          id: item.id,
          imageId: item.imageId,
          sortOrder: item.sortOrder,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          rotation: item.rotation,
          zIndex: item.zIndex,
          note: item.note,
          rating: item.rating,
          image: {
            id: item.image.id,
            title: item.image.title,
            filename: item.image.originalName,
            visibility: item.image.visibility,
            status: item.image.status,
            tags: item.image.tags.map(({ tag }) => ({
              name: tag.name,
              slug: tag.slug,
              category: tag.category,
            })),
            url: await createDownloadUrl(preview?.objectKey ?? item.image.objectKey),
            thumbnailUrl: thumbnail ? await createDownloadUrl(thumbnail.objectKey) : null,
          },
        };
      }),
    ),
  });
});

collectionsRouter.patch("/:id", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  const input = collectionUpdateSchema.parse(request.body);
  await ensureCollection(id, request);
  const collection = await prisma.collection.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
    },
  });
  response.json(collection);
});

collectionsRouter.delete("/:id", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  await ensureCollection(id, request);
  await prisma.collection.delete({ where: { id } });
  response.status(204).send();
});

collectionsRouter.post("/:id/items", async (request, response) => {
  const { id } = idSchema.parse(request.params);
  const input = addItemSchema.parse(request.body);
  await ensureCollection(id, request);
  const image = await prisma.image.findFirst({
    where: {
      id: input.imageId,
      ...(request.auth!.license?.features.includes("public-content")
        ? {
            OR: [
              { ownerTenantId: request.auth!.user.tenant.id },
              { visibility: { in: request.auth!.user.role === "public" ? ["PUBLIC"] : ["RESTRICTED", "PUBLIC"] } },
            ],
          }
        : { ownerTenantId: request.auth!.user.tenant.id }),
    },
  });
  if (!image) {
    throw new AppError(404, "Bild nicht gefunden");
  }
  const existing = await prisma.collectionItem.findUnique({
    where: { collectionId_imageId: { collectionId: id, imageId: input.imageId } },
  });
  if (existing) {
    throw new AppError(409, "Bild ist bereits auf diesem Moodboard");
  }
  const maxSortOrder = await prisma.collectionItem.aggregate({
    where: { collectionId: id },
    _max: { sortOrder: true, zIndex: true },
  });
  const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;
  const item = await prisma.collectionItem.create({
    data: {
      collectionId: id,
      imageId: input.imageId,
      sortOrder: nextSortOrder,
      x: 48 + (nextSortOrder % 3) * 280,
      y: 48 + Math.floor(nextSortOrder / 3) * 200,
      width: 260,
      zIndex: (maxSortOrder._max.zIndex ?? -1) + 1,
    },
  });
  response.status(201).json(item);
});

collectionsRouter.patch("/:id/items/:itemId", async (request, response) => {
  const { id, itemId } = itemIdSchema.parse(request.params);
  const input = updateItemSchema.parse(request.body);
  await ensureCollection(id, request);
  const item = await prisma.collectionItem.findFirst({ where: { id: itemId, collectionId: id } });
  if (!item) {
    throw new AppError(404, "Moodboard-Element nicht gefunden");
  }
  const updated = await prisma.collectionItem.update({ where: { id: itemId }, data: input });
  response.json(updated);
});

collectionsRouter.delete("/:id/items/:itemId", async (request, response) => {
  const { id, itemId } = itemIdSchema.parse(request.params);
  await ensureCollection(id, request);
  const item = await prisma.collectionItem.findFirst({ where: { id: itemId, collectionId: id } });
  if (!item) {
    throw new AppError(404, "Moodboard-Element nicht gefunden");
  }
  await prisma.collectionItem.delete({ where: { id: itemId } });
  response.status(204).send();
});

async function ensureCollection(id: string, request: Express.Request) {
  const collection = await prisma.collection.findFirst({
    where: { id, ...collectionOwner(request) },
    select: { id: true },
  });
  if (!collection) {
    throw new AppError(404, "Moodboard nicht gefunden");
  }
}

function collectionOwner(request: Express.Request) {
  return {
    tenantId: request.auth!.user.tenant.id,
    userId: request.auth!.user.id,
  };
}
