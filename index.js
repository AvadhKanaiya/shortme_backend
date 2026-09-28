import "dotenv/config";
import express from "express";
import { router as urlRoute } from "./routes/url.js";
import { router as visitorRouter } from "./routes/visitor.js";
import { connectToDb } from "./connect.js";
import { redirectLimiter } from "./middleware/rateLimiter.js";
import { URL } from "./models/url.js";
import { get, setex } from "./redis.js";
import { enqueueVisit, startAnalyticsQueue, stopAnalyticsQueue } from "./services/analyticsQueue.js";
import cors from "cors";
const app = express();
const PORT = 5001;

app.set("trust proxy", 1);

connectToDb(process.env.MONGOURL)
  .then(() => {
    console.log("connected to the db successfully");
    // Start the background analytics queue AFTER DB is ready
    startAnalyticsQueue();
  })
  .catch((err) => {
    console.log(err);
  });

app.use(express.json());
app.use(cors());
app.use("/url", urlRoute);
app.use("/visitors", visitorRouter);

app.get("/:shortId", redirectLimiter, async (req, res) => {
  const shortId = req.params.shortId;
  const cacheKey = `url:short:${shortId}`;

  try {
    // ── Step 1: Check Redis cache (Cache-Aside / Read-Through) ──────────────
    const cachedUrl = await get(cacheKey);

    if (cachedUrl) {
      // CACHE HIT — redirect instantly without hitting MongoDB
      // Log visit asynchronously (fire-and-forget, does NOT block redirect)
      enqueueVisit(shortId).catch(() => {});
      return res.redirect(cachedUrl);
    }

    // ── Step 2: CACHE MISS — query MongoDB ──────────────────────────────────
    const entry = await URL.findOne({ shortId });
    if (!entry) return res.status(404).json({ error: "Short URL not found" });

    // Prime the cache so next request is a guaranteed hit (TTL: 7 days)
    await setex(cacheKey, 60 * 60 * 24 * 7, entry.redirectUrl);

    // Log visit asynchronously (fire-and-forget)
    enqueueVisit(shortId).catch(() => {});

    return res.redirect(entry.redirectUrl);
  } catch (err) {
    console.error("[Redirect] Unexpected error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
process.on("SIGTERM", async () => {
  console.log("[Server] SIGTERM received — shutting down gracefully");
  await stopAnalyticsQueue();
  process.exit(0);
});
app.listen(PORT, () => console.log(`server is started on PORT:${PORT}`));
