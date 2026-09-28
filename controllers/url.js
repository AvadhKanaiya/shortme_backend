import shortid from "shortid";
import { URL } from "../models/url.js";
import { setex } from "../redis.js";
async function handleGenerateNewShortUrl(req, res) {
  const body = req.body;
  if (!body.url) return res.status(400).json({ message: "Url is required" });

  const shortId = shortid();

  // Persist to MongoDB
  await URL.create({
    shortId: shortId,
    redirectUrl: body.url,
    visitHistory: [],
  });

  // Write-Through: Prime Redis cache immediately so the very first visit
  // to this short link is a guaranteed CACHE HIT (TTL: 7 days)
  await setex(`url:short:${shortId}`, 60 * 60 * 24 * 7, body.url);

  return res.json({ id: shortId });
}

async function handleGetAnalytics(req, res) {
  const shortId = req.params.shortId;
  const result = await URL.findOne({ shortId });
  return res.json({
    viewers: result.visitHistory.length,
    analytics: result.visitHistory,
  });
}
export { handleGenerateNewShortUrl, handleGetAnalytics };
