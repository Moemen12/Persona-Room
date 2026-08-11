import "server-only";

import { Redis } from "@upstash/redis";

import { getServerEnvironment } from "@/infrastructure/shared/env";

export function getRedisClient() {
  const environment = getServerEnvironment();
  return new Redis({
    url: environment.UPSTASH_REDIS_REST_URL,
    token: environment.UPSTASH_REDIS_REST_TOKEN,
  });
}

export async function withRedisFallback<T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
) {
  try {
    return await operation();
  } catch (error) {
    console.warn("Redis operation failed; using durable fallback.", error);
    return fallback();
  }
}
