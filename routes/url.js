import express from "express";
import { handleGenerateNewShortUrl } from "../controllers/url.js";
import { handleGetAnalytics } from "../controllers/url.js";
import { createUrlLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/",createUrlLimiter, handleGenerateNewShortUrl);
router.get("/analytics/:shortId", handleGetAnalytics);
export { router };
