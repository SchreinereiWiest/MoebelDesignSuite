import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import type { AuthTenant, SuiteLicense } from "./types.js";

const cache = new Map<string, { expiresAt: number; value: SuiteLicense }>();

function endpoint(path: string) {
  return new URL(path.replace(/^\//, ""), `${env.LICENSE_SERVER_URL.replace(/\/$/, "")}/`);
}

function missingLicense(tenant: AuthTenant): SuiteLicense {
  return {
    licenseId: null,
    tenantId: tenant.id,
    companyName: tenant.name,
    status: "missing",
    plan: null,
    features: [],
    maxUsers: null,
    validUntil: null,
    lastCheckedAt: new Date().toISOString(),
  };
}

function normalizeLicense(payload: unknown, tenant: AuthTenant): SuiteLicense {
  if (!payload || typeof payload !== "object" || !("license" in payload)) {
    throw new AppError(502, "Der Lizenzserver hat eine ungültige Antwort geliefert");
  }
  const license = (payload as { license: Record<string, unknown> }).license;
  if (
    license.tenantId !== tenant.id
    || typeof license.companyName !== "string"
    || license.companyName.trim().toLocaleLowerCase("de-DE") !== tenant.name.trim().toLocaleLowerCase("de-DE")
  ) {
    throw new AppError(502, "Die Lizenzantwort gehört nicht zu diesem Unternehmen");
  }
  const statuses = ["active", "inactive", "expired", "suspended", "revoked"] as const;
  const status = statuses.find((candidate) => candidate === license.status);
  if (!status || !Array.isArray(license.features)) {
    throw new AppError(502, "Der Lizenzserver hat ungültige Lizenzdaten geliefert");
  }
  return {
    licenseId: typeof license.licenseId === "string" ? license.licenseId : null,
    tenantId: tenant.id,
    companyName: tenant.name,
    status,
    plan: typeof license.plan === "string" ? license.plan : null,
    features: license.features.filter((value): value is string => typeof value === "string"),
    maxUsers: typeof license.maxUsers === "number" ? license.maxUsers : null,
    validUntil: typeof license.validUntil === "string" ? license.validUntil : null,
    lastCheckedAt: new Date().toISOString(),
  };
}

async function requestLicense(
  path: "validate" | "activate",
  tenant: AuthTenant,
  licenseKey?: string,
) {
  if (!env.LICENSE_SERVER_API_KEY) {
    throw new AppError(503, "LICENSE_SERVER_API_KEY ist für die Design Suite noch nicht konfiguriert");
  }
  let response: globalThis.Response;
  try {
    response = await fetch(endpoint(`api/v1/licenses/${path}`), {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${env.LICENSE_SERVER_API_KEY}`,
        "content-type": "application/json",
        "x-license-api-version": "1",
      },
      body: JSON.stringify({
        apiVersion: "1",
        productId: env.LICENSE_SERVER_PRODUCT_ID,
        installation: { tenantId: tenant.id, companyName: tenant.name, tenantSlug: tenant.slug },
        ...(licenseKey ? { licenseKey } : {}),
      }),
      signal: AbortSignal.timeout(env.LICENSE_SERVER_TIMEOUT_MS),
    });
  } catch {
    throw new AppError(503, "Der Lizenzserver ist nicht erreichbar");
  }

  if (response.status === 404 && path === "validate") return missingLicense(tenant);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    throw new AppError(
      response.status === 401 || response.status === 403 ? 503 : response.status,
      payload?.message ?? payload?.error ?? "Die Lizenzanfrage wurde abgelehnt",
    );
  }
  return normalizeLicense(await response.json(), tenant);
}

export async function getSuiteLicense(tenant: AuthTenant, refresh = false) {
  const cached = cache.get(tenant.id);
  if (!refresh && cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await requestLicense("validate", tenant);
  cache.set(tenant.id, { value, expiresAt: Date.now() + env.LICENSE_CACHE_TTL_MS });
  return value;
}

export async function activateSuiteLicense(tenant: AuthTenant, licenseKey: string) {
  const value = await requestLicense("activate", tenant, licenseKey);
  cache.set(tenant.id, { value, expiresAt: Date.now() + env.LICENSE_CACHE_TTL_MS });
  return value;
}
