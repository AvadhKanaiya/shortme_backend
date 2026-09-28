import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient, isReady } from "../redis.js";

/**
 * Build a RedisStore for express-rate-limit.
 * Returns undefined (falls back to MemoryStore) when Redis is not available.
 */
function makeRedisStore(prefix) {
  if (!redisClient || !isReady) return undefined;
  try {
    return new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix,
    });
  } catch {
    return undefined;
  }
}

function userOrIpKey(req) {
  const userId = req.user?.id ?? req.user?._id;

  if (userId) {
    return `user:${String(userId)}`;
  }

  return `ip:${ipKeyGenerator(req.ip)}`;
}

export const createUrlLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: userOrIpKey,
  store: makeRedisStore("rl:create:"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many URLs created. Try again in a minute." },
});

export const destinationUrlLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  keyGenerator: (req) => {
    let hostname = "invalid-url";

    try {
      hostname = new URL(req.body?.url).hostname.toLowerCase();
    } catch {
      // Let the URL handler return its normal validation error.
    }

    return `${userOrIpKey(req)}:destination:${hostname}`;
  },
  store: makeRedisStore("rl:dest:"),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Too many short links created for this website. Try again in a minute.",
  },
});

export const redirectLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: userOrIpKey,
  store: makeRedisStore("rl:redirect:"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again in a minute." },
});
