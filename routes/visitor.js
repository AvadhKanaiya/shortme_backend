import express from 'express';
import { handleVisitorCount } from "../controllers/visitor.js";
const router = express.Router();
router.get("/", handleVisitorCount);
export { router };
