import { Request, Response } from "express";
import { AnalyticsService } from "./analytics.service";

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  public static async getRanking(req: Request, res: Response) {
    const { period, sort, limit } = req.query;
    const ranking = await analyticsService.getRanking({
      period: period as any,
      sort: sort as any,
      limit: limit ? Number(limit) : undefined
    });
    return res.json(ranking);
  }

  public static async getOverview(req: Request, res: Response) {
    const { period } = req.query;
    const overview = await analyticsService.getOverview(period as any);
    return res.json(overview);
  }

  public static async getPostEvolution(req: Request, res: Response) {
    const tweetId = String(req.params.tweetId);
    const evolution = await analyticsService.getPostEvolution(tweetId);
    return res.json(evolution);
  }
}
