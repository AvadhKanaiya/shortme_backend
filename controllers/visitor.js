import { Visitors } from "../models/visitor.js";
import { incr, get, setex } from "../redis.js";

const VISITOR_KEY = "global:visitor_count";
const MONGO_SYNC_EVERY = 10; // sync to MongoDB every 10 increments

async function handleVisitorCount(req, res) {
  try {
    // ── Atomic Redis INCR (1 round-trip, no race conditions) ──────────────
    const redisCount = await incr(VISITOR_KEY);

    if (redisCount !== null) {
      // Periodically sync the running total back to MongoDB for durability
      if (redisCount % MONGO_SYNC_EVERY === 0) {
        Visitors.findOneAndUpdate(
          {},
          { $set: { count: redisCount } },
          { upsert: true, new: true }
        ).catch((err) =>
          console.error("[VisitorSync] MongoDB sync failed:", err.message)
        );
      }
      return res.json({ count: redisCount });
    }

    // ── Redis unavailable — fall back to MongoDB ───────────────────────
    let visitor = await Visitors.findOne();
    if (!visitor) {
      visitor = new Visitors({ count: 1 });
      await visitor.save();
    } else {
      visitor.count += 1;
      await visitor.save();
    }
    return res.json({ count: visitor.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export { handleVisitorCount };