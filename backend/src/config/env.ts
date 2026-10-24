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
