import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: process.env.ENV_FILE ?? "../.env" });

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  VALKEY_URL: z.string().url().default("redis://localhost:6379"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("garage"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString,
  S3_AUTO_CREATE_BUCKET: booleanFromString,
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(52_428_800),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(16).default(2),
  CARPENTERS_API_URL: z.string().url().default("http://backendjs:5000"),
  LICENSE_SERVER_URL: z.string().url().default("http://licensing-api:5100"),
  LICENSE_SERVER_API_KEY: z.string().min(16).optional(),
  LICENSE_SERVER_PRODUCT_ID: z.string().min(1).default("moebel-design-suite"),
  LICENSE_SERVER_TIMEOUT_MS: z.coerce.number().int().min(250).max(60_000).default(5_000),
  LICENSE_CACHE_TTL_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(300_000),
  SESSION_SECRET: z.string().min(32).optional(),
  COOKIE_SECURE: booleanFromString,
  PUBLIC_LOGIN_KEY: z.string().min(24).optional(),
  GLOBAL_TAG_CURATOR_USER_IDS: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", z.treeifyError(parsed.error));
  throw new Error("Environment validation failed");
}

export const env = parsed.data;

export const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const globalTagCuratorUserIds = new Set(
  env.GLOBAL_TAG_CURATOR_USER_IDS.split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
