import { Redis } from "ioredis";
import { env } from "../config/env.js";

const commonOptions = {
  enableReadyCheck: true,
  lazyConnect: true,
} as const;

export const queueConnection = new Redis(env.VALKEY_URL, {
  ...commonOptions,
  maxRetriesPerRequest: 1,
});

export function createWorkerConnection() {
  return new Redis(env.VALKEY_URL, {
    ...commonOptions,
    // BullMQ workers need blocking commands and therefore no command retry limit.
    maxRetriesPerRequest: null,
  });
}
