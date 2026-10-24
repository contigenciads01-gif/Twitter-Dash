import { prisma } from "../../db/client";
import { getScoringWeights, calculateEngagementScore } from "../../config/scoring";
import { AppError } from "../../utils/errors";

export interface RankingQuery {
  period?: "7d" | "30d" | "all";
  sort?: "score" | "likes" | "retweets" | "replies" | "views";
  limit?: number;
}

export class AnalyticsService {
  /**
   * Helper para calcular o intervalo de datas do período
   */
  private getDateRange(period: "7d" | "30d" | "all" = "7d"): { startDate: Date | null; previousStartDate: Date | null; previousEndDate: Date | null } {
    const now = new Date();
    if (period === "all") {
      return { startDate: null, previousStartDate: null, previousEndDate: null };
    }

    const days = period === "7d" ? 7 : 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousEndDate = new Date(startDate.getTime());
    const previousStartDate = new Date(previousEndDate.getTime() - days * 24 * 60 * 60 * 1000);

    return { startDate, previousStartDate, previousEndDate };
  }

  /**
   * GET /api/analytics/ranking
   */
  public async getRanking(query: RankingQuery) {
    const period = query.period || "7d";
    const sortBy = query.sort || "score";
    const limit = query.limit || 20;

    const { startDate } = this.getDateRange(period);
    const weights = await getScoringWeights();

    const where: any = {
      status: "publicado",
      tweetId: { not: null }
    };

    if (startDate) {
      where.publishedAt = { gte: startDate };
    }

    // Busca os posts publicados com seus snapshots de métricas mais recentes
    const posts = await prisma.scheduledPost.findMany({
      where,
      include: {
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1
        }
      }
    });

    // Mapeia posts e calcula engagementScore
    const rankedPosts = posts.map((post) => {
      const latestSnapshot = post.snapshots[0];
      const metrics = {
        likes: latestSnapshot?.likes ?? 0,
        retweets: latestSnapshot?.retweets ?? 0,
        replies: latestSnapshot?.replies ?? 0,
        quotes: latestSnapshot?.quotes ?? 0,
        views: latestSnapshot?.views ?? null
      };

      const score = calculateEngagementScore(metrics, weights);

      return {
        id: post.id,
        tweetId: post.tweetId!,
        text: post.text,
        publishedAt: post.publishedAt || post.scheduledAt,
        metrics,
        score,
        tweetUrl: `https://twitter.com/i/web/status/${post.tweetId}`
      };
    });

    // Ordenação
    rankedPosts.sort((a, b) => {
      if (sortBy === "likes") return b.metrics.likes - a.metrics.likes;
      if (sortBy === "retweets") return b.metrics.retweets - a.metrics.retweets;
      if (sortBy === "replies") return b.metrics.replies - a.metrics.replies;
      if (sortBy === "views") return (b.metrics.views || 0) - (a.metrics.views || 0);
      return b.score - a.score;
    });

    // Adiciona posição no ranking (1, 2, 3...)
    const topRanked = rankedPosts.slice(0, limit).map((p, index) => ({
      position: index + 1,
      ...p
    }));

    return {
      period,
      sortBy,
      weights,
      totalCount: rankedPosts.length,
      ranking: topRanked
    };
  }

  /**
   * GET /api/analytics/overview
   */
  public async getOverview(period: "7d" | "30d" | "all" = "7d") {
    const { startDate, previousStartDate, previousEndDate } = this.getDateRange(period);
    const weights = await getScoringWeights();

    // 1. Posts do período atual
    const currentWhere: any = {
      status: "publicado",
      tweetId: { not: null }
    };
    if (startDate) {
      currentWhere.publishedAt = { gte: startDate };
    }

    const currentPosts = await prisma.scheduledPost.findMany({
      where: currentWhere,
      include: {
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1
        }
      }
    });

    // 2. Posts do período anterior (para cálculo de variação)
    let previousPosts: any[] = [];
    if (previousStartDate && previousEndDate) {
      previousPosts = await prisma.scheduledPost.findMany({
        where: {
          status: "publicado",
          tweetId: { not: null },
          publishedAt: {
            gte: previousStartDate,
            lt: previousEndDate
          }
        },
        include: {
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1
          }
        }
      });
    }

    // Calcula somas do período atual
    let totalLikes = 0;
    let totalRetweets = 0;
    let totalReplies = 0;
    let totalQuotes = 0;
    let totalViews: number | null = null;
    let totalScore = 0;

    // Matriz de agrupamento por dia da semana (0-6) e hora (0-23)
    const slotMap: Record<string, { totalScore: number; count: number }> = {};

    for (const post of currentPosts) {
      const snap = post.snapshots[0];
      const likes = snap?.likes ?? 0;
      const retweets = snap?.retweets ?? 0;
      const replies = snap?.replies ?? 0;
      const quotes = snap?.quotes ?? 0;
      const views = snap?.views ?? null;

      totalLikes += likes;
      totalRetweets += retweets;
      totalReplies += replies;
      totalQuotes += quotes;
      if (views !== null) {
        totalViews = (totalViews || 0) + views;
      }

      const score = calculateEngagementScore({ likes, retweets, replies, quotes, views }, weights);
      totalScore += score;

      // Agrupamento para melhor dia e horário
      const pubDate = new Date(post.publishedAt || post.scheduledAt);
      const dayOfWeek = pubDate.getDay(); // 0 (Dom) a 6 (Sáb)
      const hour = pubDate.getHours(); // 0 a 23
      const key = `${dayOfWeek}-${hour}`;

      if (!slotMap[key]) {
        slotMap[key] = { totalScore: 0, count: 0 };
      }
      slotMap[key].totalScore += score;
      slotMap[key].count += 1;
    }

    // Identifica o melhor slot
    let bestSlot = { day: 2, hour: 14, avgScore: 0 }; // Default Terça 14h
    let maxAvg = -1;

    for (const [key, val] of Object.entries(slotMap)) {
      const avg = val.totalScore / val.count;
      if (avg > maxAvg) {
        maxAvg = avg;
        const [d, h] = key.split("-").map(Number);
        bestSlot = { day: d, hour: h, avgScore: Number(avg.toFixed(2)) };
      }
    }

    // Calcula somas do período anterior
    let prevLikes = 0;
    let prevRetweets = 0;
    let prevReplies = 0;
    let prevScore = 0;

    for (const post of previousPosts) {
      const snap = post.snapshots[0];
      const likes = snap?.likes ?? 0;
      const retweets = snap?.retweets ?? 0;
      const replies = snap?.replies ?? 0;
      const quotes = snap?.quotes ?? 0;
      const views = snap?.views ?? null;

      prevLikes += likes;
      prevRetweets += retweets;
      prevReplies += replies;
      prevScore += calculateEngagementScore({ likes, retweets, replies, quotes, views }, weights);
    }

    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const count = currentPosts.length;
    const avgEngagement = count > 0 ? Number((totalScore / count).toFixed(2)) : 0;
    const prevCount = previousPosts.length;
    const prevAvg = prevCount > 0 ? Number((prevScore / prevCount).toFixed(2)) : 0;

    const daysNames = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado"
    ];

    return {
      period,
      totals: {
        posts: count,
        likes: totalLikes,
        retweets: totalRetweets,
        replies: totalReplies,
        quotes: totalQuotes,
        views: totalViews,
        engagementScore: Number(totalScore.toFixed(2)),
        avgEngagement
      },
      variations: {
        postsPercent: calcChange(count, prevCount),
        likesPercent: calcChange(totalLikes, prevLikes),
        retweetsPercent: calcChange(totalRetweets, prevRetweets),
        repliesPercent: calcChange(totalReplies, prevReplies),
        avgEngagementPercent: calcChange(avgEngagement, prevAvg)
      },
      bestTimeToPost: {
        dayOfWeek: bestSlot.day,
        dayName: daysNames[bestSlot.day],
        hour: bestSlot.hour,
        formattedTime: `${String(bestSlot.hour).padStart(2, "0")}:00`,
        avgScore: bestSlot.avgScore
      },
      heatmap: Object.entries(slotMap).map(([key, val]) => {
        const [day, hour] = key.split("-").map(Number);
        return {
          day,
          dayName: daysNames[day],
          hour,
          postsCount: val.count,
          avgScore: Number((val.totalScore / val.count).toFixed(2))
        };
      })
    };
  }

  /**
   * GET /api/analytics/post/:tweetId
   */
  public async getPostEvolution(tweetId: string) {
    const post = await prisma.scheduledPost.findUnique({
      where: { tweetId }
    });

    const snapshots = await prisma.tweetMetricsSnapshot.findMany({
      where: { tweetId },
      orderBy: { capturedAt: "asc" }
    });

    if (snapshots.length === 0 && !post) {
      throw new AppError("Tweet não encontrado.", 404, "TWEET_NOT_FOUND");
    }

    const weights = await getScoringWeights();

    const timeline = snapshots.map((s) => ({
      capturedAt: s.capturedAt,
      likes: s.likes,
      retweets: s.retweets,
      replies: s.replies,
      quotes: s.quotes,
      views: s.views,
      score: calculateEngagementScore(
        { likes: s.likes, retweets: s.retweets, replies: s.replies, quotes: s.quotes, views: s.views },
        weights
      )
    }));

    return {
      tweetId,
      postText: post?.text || "",
      publishedAt: post?.publishedAt || post?.scheduledAt,
      snapshotsCount: snapshots.length,
      timeline
    };
  }
}
