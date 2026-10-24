import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import type { AuthUser } from "./types.js";

type CarpentersPayload = {
  id: string;
  email: string;
  login: string;
  role: "admin" | "manager" | "user";
  tenant: { id: string; name: string; slug: string; status?: string };
};

function endpoint(path: string) {
  return new URL(path.replace(/^\//, ""), `${env.CARPENTERS_API_URL.replace(/\/$/, "")}/`);
}

function toAuthUser(payload: CarpentersPayload): AuthUser {
  if (!payload?.id || !payload?.tenant?.id || !["admin", "manager", "user"].includes(payload.role)) {
    throw new AppError(502, "Der Identitätsdienst hat ungültige Benutzerdaten geliefert");
  }
  return { ...payload, provider: "carpenters" };
}

export async function loginWithCarpenters(input: {
  company: string;
  login: string;
  password: string;
}) {
  let response: globalThis.Response;
  try {
    response = await fetch(endpoint("api/auth/login"), {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new AppError(503, "Der Carpenters-Anmeldedienst ist nicht erreichbar");
  }

  const payload = (await response.json().catch(() => null)) as
    | { user?: CarpentersPayload; error?: string; message?: string }
    | null;
  if (!response.ok || !payload?.user) {
    const isLicenseError = payload?.error?.startsWith("LICENSE_");
    throw new AppError(
      isLicenseError ? response.status : 401,
      isLicenseError ? payload?.message ?? "Die Carpenters-Lizenz ist nicht aktiv" : "Firma, Benutzer oder Passwort ist ungültig",
    );
  }

  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const tokenCookie = setCookies.find((value) => /(?:^|,\s*)token=/.test(value));
  const token = tokenCookie?.match(/(?:^|,\s*)token=([^;]+)/)?.[1];
  if (!token) throw new AppError(502, "Der Identitätsdienst hat keine Sitzung geliefert");

  return { user: toAuthUser(payload.user), token: decodeURIComponent(token) };
}

export async function getCarpentersUser(token: string) {
  let response: globalThis.Response;
  try {
    response = await fetch(endpoint("api/auth/me"), {
      headers: { accept: "application/json", cookie: `token=${encodeURIComponent(token)}` },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new AppError(503, "Der Carpenters-Anmeldedienst ist nicht erreichbar");
  }
  if (!response.ok) throw new AppError(401, "Sitzung ist abgelaufen");
  return toAuthUser((await response.json()) as CarpentersPayload);
}
