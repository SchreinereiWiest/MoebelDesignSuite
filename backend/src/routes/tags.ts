import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const querySchema = z.object({
  category: z
    .enum(["ROOM", "FURNITURE", "MATERIAL", "COLOR", "STYLE", "FEATURE", "TECHNICAL"])
    .optional(),
});

export const tagsRouter = Router();

tagsRouter.get("/", async (request, response) => {
  const query = querySchema.parse(request.query);
  const tags = await prisma.tag.findMany({
    where: query.category ? { category: query.category } : {},
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { images: true } } },
  });

  response.json({
    data: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      category: tag.category,
      imageCount: tag._count.images,
    })),
  });
});
