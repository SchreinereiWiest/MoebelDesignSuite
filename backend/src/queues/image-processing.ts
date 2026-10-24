import { Queue } from "bullmq";
import { queueConnection } from "../lib/redis.js";

export const IMAGE_PROCESSING_QUEUE = "image-processing";

export type ImageProcessingJob = {
  imageId: string;
};

export const imageProcessingQueue = new Queue<ImageProcessingJob>(
  IMAGE_PROCESSING_QUEUE,
  {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 604_800, count: 5_000 },
    },
  },
);

export function enqueueImageProcessing(imageId: string) {
  return imageProcessingQueue.add("process-image", { imageId }, { jobId: imageId });
}
