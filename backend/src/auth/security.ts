import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { allowedOrigins, env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/public-mode",
  "/api/auth/public-login",
]);

export const SESSION_COOKIE = "mds-session";
export const CSRF_COOKIE = "MDS-XSRF-TOKEN";
export const PUBLIC_MODE_COOKIE = "mds-public-mode";

const baseCookieOptions = {
  secure: env.COOKIE_SECURE,
  sameSite: "strict" as const,
  path: "/",
};

export function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function setIdentityCookie(response: Response, token: string) {
  response.cookie(SESSION_COOKIE, token, {
    ...baseCookieOptions,
    httpOnly: true,
    maxAge: 12 * 60 * 60 * 1_000,
  });
}

export function clearAuthCookies(response: Response) {
  response.clearCookie(SESSION_COOKIE, { ...baseCookieOptions, httpOnly: true });
  response.clearCookie(CSRF_COOKIE, { ...baseCookieOptions, httpOnly: false });
  response.clearCookie(PUBLIC_MODE_COOKIE, { ...baseCookieOptions, httpOnly: true });
}

export function issueCsrfToken(response: Response) {
  const token = crypto.randomBytes(32).toString("hex");
  response.cookie(CSRF_COOKIE, token, {
    ...baseCookieOptions,
    httpOnly: false,
    maxAge: 12 * 60 * 60 * 1_000,
  });
  return token;
}

function sameToken(left?: string, right?: string) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyBrowserRequest(request: Request, _response: Response, next: NextFunction) {
  if (SAFE_METHODS.has(request.method)) return next();

  const origin = request.get("origin");
  if (origin && !allowedOrigins.includes(origin)) {
    return next(new AppError(403, "Origin ist nicht erlaubt"));
  }
  if (CSRF_EXEMPT_PATHS.has(request.path)) return next();

  const cookies = parseCookies(request.get("cookie"));
  const header = request.get("x-xsrf-token") ?? request.get("x-csrf-token") ?? undefined;
  if (!sameToken(cookies[CSRF_COOKIE], header)) {
    return next(new AppError(403, "Ungültiges CSRF-Token"));
  }
  return next();
}

function signPublicMode(expiresAt: number) {
  const payload = String(expiresAt);
  const signingSecret = env.SESSION_SECRET ?? env.PUBLIC_LOGIN_KEY;
  if (!signingSecret) throw new AppError(503, "Der öffentliche Login-Modus ist nicht konfiguriert");
  const signature = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function setPublicModeCookie(response: Response) {
  const expiresAt = Date.now() + 30 * 60 * 1_000;
  response.cookie(PUBLIC_MODE_COOKIE, signPublicMode(expiresAt), {
    ...baseCookieOptions,
    httpOnly: true,
    maxAge: 30 * 60 * 1_000,
  });
}

export function hasPublicMode(request: Request) {
  const value = parseCookies(request.get("cookie"))[PUBLIC_MODE_COOKIE];
  if (!value) return false;
  const [expiresAtRaw, signature] = value.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAtRaw || !signature || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  return sameToken(signPublicMode(expiresAt).split(".")[1], signature);
}

export function publicKeyMatches(candidate: string) {
  if (!env.PUBLIC_LOGIN_KEY) return false;
  const expected = crypto.createHash("sha256").update(env.PUBLIC_LOGIN_KEY).digest();
  const actual = crypto.createHash("sha256").update(candidate).digest();
  return crypto.timingSafeEqual(expected, actual);
}
