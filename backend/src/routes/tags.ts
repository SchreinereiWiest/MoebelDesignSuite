import { Router } from "express";
import { z } from "zod";
import { globalTagCuratorUserIds } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "../lib/errors.js";
import { requirePermission } from "../auth/middleware.js";

const categories = ["ROOM", "FURNITURE", "MATERIAL", "COLOR", "STYLE", "FEATURE", "TECHNICAL"] as const;
const querySchema = z.object({ category: z.enum(categories).optional(), search: z.string().trim().max(80).optional() });
const proposalSchema = z.object({ name: z.string().trim().min(2).max(80), category: z.enum(categories) });
const resolutionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), decisionNote: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("merge"), targetTagId: z.string().uuid(), decisionNote: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("reject"), decisionNote: z.string().trim().min(2).max(500) }),
]);

export const tagsRouter = Router();

tagsRouter.get("/", async (request, response) => {
  const query = querySchema.parse(request.query);
  const tags = await prisma.tag.findMany({
    where: {
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          { aliases: { some: { name: { contains: query.search, mode: "insensitive" as const } } } },
        ],
      } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { aliases: true, _count: { select: { images: true } } },
  });

  response.json({ data: tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    category: tag.category,
    aliases: tag.aliases.map((alias) => alias.name),
    imageCount: tag._count.images,
  })) });
});

tagsRouter.get("/suggestions", async (request, response) => {
  const { search, category } = querySchema.extend({ search: z.string().trim().min(2).max(80) }).parse(request.query);
  response.json({ data: await findSuggestions(search, category) });
});

tagsRouter.get("/proposals", requirePermission("proposeTags"), async (request, response) => {
  const isCurator = globalTagCuratorUserIds.has(request.auth!.user.id);
  const proposals = await prisma.tagProposal.findMany({
    where: isCurator ? {} : { tenantId: request.auth!.user.tenant.id },
    orderBy: { createdAt: "desc" },
    include: { resolvedTag: { select: { id: true, name: true, slug: true } } },
  });
  response.json({ data: proposals });
});

tagsRouter.post("/proposals", requirePermission("proposeTags"), async (request, response) => {
  const input = proposalSchema.parse(request.body);
  const normalizedName = normalizeTag(input.name);
  const suggestions = await findSuggestions(input.name, input.category);
  const exact = suggestions.find((suggestion) => suggestion.exact);
  if (exact) throw new AppError(409, `Der Begriff ist bereits dem Tag „${exact.name}“ zugeordnet`, { suggestions });
  const duplicate = await prisma.tagProposal.findFirst({ where: { normalizedName, status: "PENDING" } });
  if (duplicate) throw new AppError(409, "Dieser Tag wurde bereits zur globalen Prüfung vorgeschlagen", { suggestions });

  const proposal = await prisma.tagProposal.create({
    data: {
      proposedName: input.name,
      normalizedName,
      category: input.category,
      tenantId: request.auth!.user.tenant.id,
      proposedBy: request.auth!.user.id,
    },
  });
  response.status(201).json({ proposal, suggestions });
});

tagsRouter.post("/proposals/:id/resolve", requirePermission("curateGlobalTags"), async (request, response) => {
  const id = z.string().uuid().parse(request.params.id);
  const input = resolutionSchema.parse(request.body);
  const proposal = await prisma.tagProposal.findUnique({ where: { id } });
  if (!proposal) throw new AppError(404, "Tag-Vorschlag nicht gefunden");
  if (proposal.status !== "PENDING") throw new AppError(409, "Der Vorschlag wurde bereits bearbeitet");

  const resolved = await prisma.$transaction(async (transaction) => {
    if (input.action === "reject") {
      return transaction.tagProposal.update({
        where: { id },
        data: { status: "REJECTED", decisionNote: input.decisionNote, resolvedBy: request.auth!.user.id, resolvedAt: new Date() },
      });
    }

    let tagId: string;
    if (input.action === "merge") {
      const target = await transaction.tag.findUnique({ where: { id: input.targetTagId } });
      if (!target) throw new AppError(404, "Ziel-Tag nicht gefunden");
      tagId = target.id;
      await transaction.tagAlias.upsert({
        where: { normalizedName: proposal.normalizedName },
        create: { tagId, name: proposal.proposedName, normalizedName: proposal.normalizedName },
        update: { tagId, name: proposal.proposedName },
      });
    } else {
      const tag = await transaction.tag.create({
        data: { name: proposal.proposedName, normalizedName: proposal.normalizedName, slug: slugify(proposal.proposedName), category: proposal.category },
      });
      tagId = tag.id;
    }

    return transaction.tagProposal.update({
      where: { id },
      data: {
        status: input.action === "merge" ? "MERGED" : "APPROVED",
        resolvedTagId: tagId,
        decisionNote: input.decisionNote,
        resolvedBy: request.auth!.user.id,
        resolvedAt: new Date(),
      },
    });
  });
  response.json(resolved);
});

export function normalizeTag(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function findSuggestions(name: string, category?: (typeof categories)[number]) {
  const normalized = normalizeTag(name);
  const tags = await prisma.tag.findMany({ where: category ? { category } : {}, include: { aliases: true } });
  return tags.map((tag) => {
    const candidates = [tag.normalizedName, ...tag.aliases.map((alias) => alias.normalizedName)];
    const exact = candidates.includes(normalized);
    const score = Math.max(...candidates.map((candidate) => similarity(normalized, candidate)));
    return { id: tag.id, name: tag.name, slug: tag.slug, category: tag.category, aliases: tag.aliases.map((alias) => alias.name), exact, score };
  }).filter((suggestion) => suggestion.exact || suggestion.score >= 0.35)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score)
    .slice(0, 8);
}

function similarity(left: string, right: string) {
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.8;
  const a = bigrams(left);
  const b = bigrams(right);
  let overlap = 0;
  const remaining = [...b];
  for (const pair of a) {
    const index = remaining.indexOf(pair);
    if (index >= 0) { overlap += 1; remaining.splice(index, 1); }
  }
  return a.length + b.length ? (2 * overlap) / (a.length + b.length) : 0;
}

function bigrams(value: string) {
  if (value.length < 2) return [value];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}

function slugify(value: string) {
  return normalizeTag(value).replace(/\s+/g, "-").slice(0, 80);
}
