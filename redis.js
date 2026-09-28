import "dotenv/config";
import Redis from "ioredis";

// ─── Connection ──────────────────────────────────────────────────────────────
// Reads REDIS_URL from .env (e.g. "redis://localhost:6379").
// Falls back gracefully: if Redis is down, isReady stays false and callers
// skip cache without throwing.
let client = null;
let isReady = false;

function createClient() {
  const url = process.env.REDIS_URL;

  if (!url) {
    console.warn("[Redis] REDIS_URL is not set – caching is DISABLED.");
    return null;
  }

  const redis = new Redis(url, {
    // Retry with exponential backoff, max 5 attempts if auth fails or max 10s
    retryStrategy(times) {
      if (times > 5) {
        console.error(
          "[Redis] Max reconnect attempts reached. Caching disabled.",
        );
        return null; // Stop retrying
      }
      const delay = Math.min(times * 500, 5_000);
      console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    maxRetriesPerRequest: 1, // Don't block requests waiting for Redis
    enableOfflineQueue: false, // Fail fast instead of queueing commands
    lazyConnect: true,
  });

  redis.on("connect", () => console.log("[Redis] Connected"));
  redis.on("ready", () => {
    isReady = true;
    console.log("[Redis] Ready to serve requests");
  });
  redis.on("error", (err) => {
    console.error("[Redis] Error:", err.message);
    isReady = false;
  });
  redis.on("close", () => {
    isReady = false;
  });
  redis.on("reconnecting", () => console.warn("[Redis] Reconnecting…"));

  // Kick off the connection without blocking startup
  redis.connect().catch(() => {});

  return redis;
}

client = createClient();

// ─── Helper Wrappers (all are no-ops when Redis is unavailable) ───────────────

/**
 * Get a string value from Redis.
 * Returns null on cache miss OR when Redis is down (safe fallback).
 */
export async function get(key) {
  if (!client || !isReady) return null;
  try {
    return await client.get(key);
  } catch (err) {
    console.error(`[Redis] GET "${key}" failed:`, err.message);
    return null;
  }
}

/**
 * Set a string value with a TTL in seconds (SETEX).
 * Silently skips when Redis is down.
 */
export async function setex(key, ttlSeconds, value) {
  if (!client || !isReady) return;
  try {
    await client.set(key, value, "EX", ttlSeconds);
  } catch (err) {
    console.error(`[Redis] SET "${key}" failed:`, err.message);
  }
}

/**
 * Delete a key from Redis.
 */
export async function del(key) {
  if (!client || !isReady) return;
  try {
    await client.del(key);
  } catch (err) {
    console.error(`[Redis] DEL "${key}" failed:`, err.message);
  }
}

/**
 * Atomically increment a counter. Returns the new value, or null on failure.
 */
export async function incr(key) {
  if (!client || !isReady) return null;
  try {
    return await client.incr(key);
  } catch (err) {
    console.error(`[Redis] INCR "${key}" failed:`, err.message);
    return null;
  }
}

/**
 * Push one or more values to the left of a Redis list (LPUSH).
 */
export async function lpush(key, ...values) {
  if (!client || !isReady) return;
  try {
    await client.lpush(key, ...values);
  } catch (err) {
    console.error(`[Redis] LPUSH "${key}" failed:`, err.message);
  }
}

/**
 * Pop `count` items from the right of a Redis list (blocking-aware RPOP).
 * Returns an array (empty when list is empty or Redis is down).
 */
export async function rpopMany(key, count) {
  if (!client || !isReady) return [];
  try {
    // Upstash (Redis 7) natively supports RPOP key count in a single command
    const res = await client.rpop(key, count);
    if (!res) return [];
    return Array.isArray(res) ? res : [res];
  } catch (err) {
    console.error(`[Redis] RPOP "${key}" failed:`, err.message);
    return [];
  }
}

/**
 * Retrieve the current length of a Redis list.
 */
export async function llen(key) {
  if (!client || !isReady) return 0;
  try {
    return await client.llen(key);
  } catch (err) {
    return 0;
  }
}

// Export raw client for rate-limit-redis (needs the ioredis instance)
export { client as redisClient, isReady };
