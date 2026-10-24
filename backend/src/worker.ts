import { Worker } from "bullmq";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createWorkerConnection } from "./lib/redis.js";
import { ensureBucket, s3 } from "./lib/s3.js";
import {
  IMAGE_PROCESSING_QUEUE,
  type ImageProcessingJob,
} from "./queues/image-processing.js";
import { processImage } from "./workers/process-image.js";

await ensureBucket();

const connection = createWorkerConnection();
const worker = new Worker<ImageProcessingJob>(IMAGE_PROCESSING_QUEUE, processImage, {
  connection,
  concurrency: env.WORKER_CONCURRENCY,
});

worker.on("completed", (job, result) => {
  console.log(`Image job ${job.id} completed`, result);
});

worker.on("failed", (job, error) => {
  console.error(`Image job ${job?.id ?? "unknown"} failed`, error);
});

console.log(`Image worker started with concurrency ${env.WORKER_CONCURRENCY}`);

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting worker down`);
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  s3.destroy();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
