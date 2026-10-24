import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { queueConnection } from "../lib/redis.js";
import { s3 } from "../lib/s3.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    queueConnection.ping(),
    s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })),
  ]);

  const names = ["database", "valkey", "storage"] as const;
  const services = Object.fromEntries(
    checks.map((check, index) => [names[index], check.status === "fulfilled" ? "up" : "down"]),
  );
  const healthy = checks.every((check) => check.status === "fulfilled");

  response.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "moebel-design-suite-api",
    services,
    timestamp: new Date().toISOString(),
  });
});
