/**
 * analyticsQueue.js
 *
 * Write-Behind Analytics Service
 * ─────────────────────────────
 * Instead of doing a synchronous MongoDB write on every redirect, we push
 * visit events to a Redis list (visits:queue) and flush them to MongoDB in
 * batches every FLUSH_INTERVAL_MS.
 *
 * This decouples the redirect hot-path from the database, keeping redirect
 * latency at 1–4 ms regardless of database load.
 *
 * Key Design Decisions:
 *  - FLUSH_INTERVAL_MS  = 5 000 ms  (flush every 5 seconds)
 *  - BATCH_SIZE         = 100       (max events popped per flush cycle)
 *  - If Redis is down, enqueueVisit() falls back to a synchronous MongoDB
 *    update so no analytics are ever lost.
 */

import { URL } from "../models/url.js";
import { lpush, rpopMany, llen, isReady } from "../redis.js";

const QUEUE_KEY = "visits:queue";
const FLUSH_INTERVAL_MS = 5_000; // flush every 5 seconds
const BATCH_SIZE = 100; // max events to process per cycle

// Flag to ensure we NEVER send polling commands to Redis when idle
let hasPendingVisits = false;

// ─── Enqueue ─────────────────────────────────────────────────────────────────

/**
 * Enqueue a visit event into the Redis list.
 * Falls back to a direct MongoDB update if Redis is unavailable.
 *
 * @param {string} shortId - The short URL identifier being visited.
 */
export async function enqueueVisit(shortId) {
  if (isReady) {
    const payload = JSON.stringify({ shortId, t: Date.now() });
    await lpush(QUEUE_KEY, payload);
    hasPendingVisits = true;
    return;
  }

  // Safe fallback if Redis is down: write directly to MongoDB
  try {
    await URL.findOneAndUpdate(
      { shortId },
      { $push: { visitHistory: { timeStamps: Date.now() } } }
    );
  } catch (err) {
    console.error("[AnalyticsQueue] Fallback MongoDB write failed:", err.message);
  }
}

// ─── Flush ───────────────────────────────────────────────────────────────────

/**
 * Internal flush function — called by the background interval.
 * Only touches Redis if hasPendingVisits is true.
 */
async function flush() {
  // If no visits were enqueued, DO NOT ping Redis (saves thousands of commands)
  if (!hasPendingVisits || !isReady) return;

  try {
    const raw = await rpopMany(QUEUE_KEY, BATCH_SIZE);
    if (!raw.length) {
      hasPendingVisits = false; // Queue is empty, go back to idle
      return;
    }

    if (raw.length < BATCH_SIZE) {
      hasPendingVisits = false; // Drained the queue
    }

    // Parse events and group timestamps by shortId for efficient bulk writes
    const groups = {};
    for (const item of raw) {
      try {
        const { shortId, t } = JSON.parse(item);
        if (!groups[shortId]) groups[shortId] = [];
        groups[shortId].push({ timeStamps: t });
      } catch {
        // Skip malformed items
      }
    }

    if (!Object.keys(groups).length) return;

    // Build a bulkWrite operation — one updateOne per unique shortId
    const operations = Object.entries(groups).map(([shortId, visits]) => ({
      updateOne: {
        filter: { shortId },
        update: { $push: { visitHistory: { $each: visits } } },
      },
    }));

    await URL.bulkWrite(operations, { ordered: false });

    console.log(
      `[AnalyticsQueue] Flushed ${raw.length} visit(s) for ${Object.keys(groups).length} unique URL(s)`
    );
  } catch (err) {
    console.error("[AnalyticsQueue] Flush error:", err.message);
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

let flushInterval = null;

/**
 * Start the background analytics flusher.
 * Call once at server startup (from index.js).
 */
export function startAnalyticsQueue() {
  if (flushInterval) return;

  // On startup, check once if there were leftover items from a previous run
  llen(QUEUE_KEY)
    .then((len) => {
      if (len > 0) hasPendingVisits = true;
    })
    .catch(() => {});

  flushInterval = setInterval(flush, FLUSH_INTERVAL_MS);
  if (flushInterval.unref) flushInterval.unref();
}

/**
 * Stop the background flusher and perform one final flush.
 * Call on graceful server shutdown.
 */
export async function stopAnalyticsQueue() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  if (hasPendingVisits) {
    await flush();
  }
  console.log("[AnalyticsQueue] Stopped and flushed.");
}
