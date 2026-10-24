import { Router } from "express";
import { z } from "zod";
import { activateSuiteLicense, getSuiteLicense } from "../auth/licensing.js";
import { requirePermission } from "../auth/middleware.js";

export const licenseRouter = Router();

licenseRouter.get("/current", requirePermission("viewLicense"), async (request, response) => {
  const refresh = request.query.refresh === "true";
  const license = await getSuiteLicense(request.auth!.user.tenant, refresh);
  response.json({ tenant: request.auth!.user.tenant, license });
});

licenseRouter.put("/current", requirePermission("manageLicense"), async (request, response) => {
  const { licenseKey } = z.object({ licenseKey: z.string().trim().min(1).max(16_384) }).parse(request.body);
  const license = await activateSuiteLicense(request.auth!.user.tenant, licenseKey);
  response.json({ tenant: request.auth!.user.tenant, license });
});
