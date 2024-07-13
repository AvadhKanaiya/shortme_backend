
import express from 'express';
import { handleGenerateNewShortUrl } from '../controllers/url.js';
import { handleGetAnalytics } from '../controllers/url.js';
const router = express.Router();

router.post("/", handleGenerateNewShortUrl);
router.get("/analytics/:shortId", handleGetAnalytics);
export { router };
