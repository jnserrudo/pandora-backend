import { Router } from "express";
import { getPublicStats } from "../controllers/public.controller.js";

const router = Router();

router.get("/stats", getPublicStats);

export default router;
