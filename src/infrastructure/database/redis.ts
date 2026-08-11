import { Redis } from '@upstash/redis';
import { env } from '../shared/env';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Redis not configured - caching disabled');
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      return null;
    }
  }

  return redisClient;
}

export async function cacheSet(
  key: string,
  value: unknown,
  expirationSeconds = 3600,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(key, expirationSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to set cache key ${key}:`, error);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(typeof value === 'string' ? value : JSON.stringify(value)) as T;
  } catch (error) {
    console.error(`Failed to get cache key ${key}:`, error);
    return null;
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Failed to delete cache key ${key}:`, error);
  }
}

export async function cacheIncrement(key: string, amount = 1): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  try {
    const result = await redis.incrby(key, amount);
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    console.error(`Failed to increment cache key ${key}:`, error);
    return 0;
  }
}
