import type { NextFunction, Request, Response } from "express";
import { globalTagCuratorUserIds } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { getCarpentersUser } from "./carpenters.js";
import { getSuiteLicense } from "./licensing.js";
import { parseCookies, SESSION_COOKIE } from "./security.js";
import { permissionsFor, type TenantRole } from "./types.js";

export async function requireIdentity(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = parseCookies(request.get("cookie"))[SESSION_COOKIE];
    if (!token) throw new AppError(401, "Nicht angemeldet");
    request.auth = { user: await getCarpentersUser(token) };
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireActiveSuiteLicense(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  try {
    if (!request.auth) throw new AppError(401, "Nicht angemeldet");
    const license = await getSuiteLicense(request.auth.user.tenant);
    request.auth.license = license;
    if (license.status !== "active") {
      throw new AppError(403, "Die Design Suite ist für dieses Unternehmen nicht freigeschaltet", {
        code: "SUITE_LICENSE_INACTIVE",
        status: license.status,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles: TenantRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth) return next(new AppError(401, "Nicht angemeldet"));
    if (!roles.includes(request.auth.user.role)) return next(new AppError(403, "Keine Berechtigung"));
    return next();
  };
}

export function requirePermission(permission: keyof ReturnType<typeof permissionsFor>) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth) return next(new AppError(401, "Nicht angemeldet"));
    const permissions = permissionsFor(
      request.auth.user.role,
      request.auth.license?.features ?? [],
      globalTagCuratorUserIds.has(request.auth.user.id),
    );
    if (!permissions[permission]) return next(new AppError(403, "Keine Berechtigung"));
    return next();
  };
}

export function requireLicenseFeature(feature: string) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth?.license) return next(new AppError(401, "Nicht angemeldet"));
    if (!request.auth.license.features.includes(feature)) {
      return next(new AppError(403, `Das Lizenzmodul „${feature}“ ist nicht freigeschaltet`, {
        code: "LICENSE_FEATURE_MISSING",
        feature,
      }));
    }
    return next();
  };
}
