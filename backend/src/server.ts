import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { queueConnection } from "./lib/redis.js";
import { ensureBucket } from "./lib/s3.js";
import { imageProcessingQueue } from "./queues/image-processing.js";

await ensureBucket();

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`API listening on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`);
  server.close(async () => {
    await Promise.allSettled([
      imageProcessingQueue.close(),
      queueConnection.quit(),
      prisma.$disconnect(),
    ]);
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
