import { Router } from "express";
import { z } from "zod";
import { globalTagCuratorUserIds } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { loginWithCarpenters } from "../auth/carpenters.js";
import { getSuiteLicense } from "../auth/licensing.js";
import { requireIdentity } from "../auth/middleware.js";
import {
  clearAuthCookies,
  hasPublicMode,
  issueCsrfToken,
  publicKeyMatches,
  setIdentityCookie,
  setPublicModeCookie,
} from "../auth/security.js";
import { permissionsFor, type AuthUser } from "../auth/types.js";

const loginSchema = z.object({
  company: z.string().trim().min(1).max(160),
  login: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(1_024),
});

function sessionPayload(user: AuthUser, license: Awaited<ReturnType<typeof getSuiteLicense>>) {
  return {
    user,
    license,
    permissions: permissionsFor(user.role, license.features, globalTagCuratorUserIds.has(user.id)),
  };
}

export const authRouter = Router();

authRouter.post("/login", async (request, response) => {
  const input = loginSchema.parse(request.body);
  const { user, token } = await loginWithCarpenters(input);
  const license = await getSuiteLicense(user.tenant);
  setIdentityCookie(response, token);
  const csrfToken = issueCsrfToken(response);
  response.json({ ...sessionPayload(user, license), csrfToken });
});

authRouter.get("/me", requireIdentity, async (request, response) => {
  const user = request.auth!.user;
  const license = await getSuiteLicense(user.tenant);
  response.json(sessionPayload(user, license));
});

authRouter.post("/logout", (_request, response) => {
  clearAuthCookies(response);
  response.status(204).send();
});

authRouter.get("/mode", (request, response) => {
  response.json({ mode: hasPublicMode(request) ? "public" : "company" });
});

authRouter.post("/public-mode", (request, response) => {
  const { key } = z.object({ key: z.string().min(1).max(1_024) }).parse(request.body);
  if (!publicKeyMatches(key)) throw new AppError(401, "Der öffentliche Zugangslink ist ungültig oder abgelaufen");
  setPublicModeCookie(response);
  response.json({ mode: "public" });
});

authRouter.post("/public-login", (request, _response) => {
  if (!hasPublicMode(request)) throw new AppError(403, "Öffentlicher Zugang wurde nicht freigeschaltet");
  throw new AppError(501, "Die öffentliche Benutzerverwaltung wird in einem späteren Schritt angebunden");
});
