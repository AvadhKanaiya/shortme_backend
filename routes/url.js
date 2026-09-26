import express from "express";
import { handleGenerateNewShortUrl } from "../controllers/url.js";
import { handleGetAnalytics } from "../controllers/url.js";
import {
  createUrlLimiter,
  destinationUrlLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();

router.post(
  "/",
  createUrlLimiter,
  destinationUrlLimiter,
  handleGenerateNewShortUrl,
);
router.get("/analytics/:shortId", handleGetAnalytics);
export { router };
