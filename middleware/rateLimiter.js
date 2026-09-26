import { rateLimit, ipKeyGenerator } from "express-rate-limit";

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
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many URLs created. Try again in a minute." },
});

export const redirectLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again in a minute." },
});
