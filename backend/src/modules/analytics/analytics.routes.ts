import { Router } from "express";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

router.get("/ranking", AnalyticsController.getRanking);
router.get("/overview", AnalyticsController.getOverview);
router.get("/post/:tweetId", AnalyticsController.getPostEvolution);

export default router;
