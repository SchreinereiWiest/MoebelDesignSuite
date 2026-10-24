import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../auth/middleware.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "../lib/errors.js";

const updateSchema = z.object({
  libraryDensity: z.enum(["COMFORTABLE", "COMPACT"]),
  defaultVisibility: z.enum(["PRIVATE", "RESTRICTED", "PUBLIC"]),
  showExternalImages: z.boolean(),
});

export const settingsRouter = Router();

settingsRouter.get("/tenant", async (request, response) => {
  const tenantId = request.auth!.user.tenant.id;
  const settings = await prisma.tenantSetting.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
  response.json(settings);
});

settingsRouter.put("/tenant", requirePermission("manageCompanySettings"), async (request, response) => {
  const input = updateSchema.parse(request.body);
  if (
    !request.auth!.license?.features.includes("public-content")
    && (input.defaultVisibility !== "PRIVATE" || input.showExternalImages)
  ) {
    throw new AppError(403, "Öffentliche Inhalte sind in dieser Lizenz nicht freigeschaltet");
  }
  const { id: updatedBy, tenant } = request.auth!.user;
  const settings = await prisma.tenantSetting.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, updatedBy, ...input },
    update: { updatedBy, ...input },
  });
  response.json(settings);
});

settingsRouter.get(
  "/overview",
  requirePermission("manageOwnTenantImages"),
  async (request, response) => {
    const tenantId = request.auth!.user.tenant.id;
    const [images, sharedImages, tags, pendingTags] = await prisma.$transaction([
      prisma.image.count({ where: { ownerTenantId: tenantId } }),
      prisma.image.count({
        where: { ownerTenantId: tenantId, visibility: { in: ["RESTRICTED", "PUBLIC"] } },
      }),
      prisma.tag.count(),
      prisma.tagProposal.count({ where: { tenantId, status: "PENDING" } }),
    ]);
    response.json({ images, sharedImages, tags, pendingTags });
  },
);
