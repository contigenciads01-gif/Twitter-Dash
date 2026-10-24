import { prisma } from "../db/client";

export interface ScoringWeights {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  views: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  likes: 1,
  retweets: 3,
  replies: 2,
  quotes: 3,
  views: 0.01
};

export async function getScoringWeights(): Promise<ScoringWeights> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "scoring_weights" }
    });

    if (setting) {
      const parsed = JSON.parse(setting.value);
      return {
        likes: Number(parsed.likes ?? DEFAULT_WEIGHTS.likes),
        retweets: Number(parsed.retweets ?? DEFAULT_WEIGHTS.retweets),
        replies: Number(parsed.replies ?? DEFAULT_WEIGHTS.replies),
        quotes: Number(parsed.quotes ?? DEFAULT_WEIGHTS.quotes),
        views: Number(parsed.views ?? DEFAULT_WEIGHTS.views)
      };
    }
  } catch (_) {}

  return DEFAULT_WEIGHTS;
}

export async function updateScoringWeights(newWeights: Partial<ScoringWeights>): Promise<ScoringWeights> {
  const current = await getScoringWeights();
  const merged: ScoringWeights = {
    likes: newWeights.likes !== undefined ? Number(newWeights.likes) : current.likes,
    retweets: newWeights.retweets !== undefined ? Number(newWeights.retweets) : current.retweets,
    replies: newWeights.replies !== undefined ? Number(newWeights.replies) : current.replies,
    quotes: newWeights.quotes !== undefined ? Number(newWeights.quotes) : current.quotes,
    views: newWeights.views !== undefined ? Number(newWeights.views) : current.views
  };

  await prisma.appSetting.upsert({
    where: { key: "scoring_weights" },
    create: {
      key: "scoring_weights",
      value: JSON.stringify(merged)
    },
    update: {
      value: JSON.stringify(merged)
    }
  });

  return merged;
}

export function calculateEngagementScore(
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes?: number;
    views?: number | null;
  },
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const likesScore = (metrics.likes || 0) * weights.likes;
  const retweetsScore = (metrics.retweets || 0) * weights.retweets;
  const repliesScore = (metrics.replies || 0) * weights.replies;
  const quotesScore = (metrics.quotes || 0) * weights.quotes;
  const viewsScore = (metrics.views !== null && metrics.views !== undefined) ? metrics.views * weights.views : 0;

  const total = likesScore + retweetsScore + repliesScore + quotesScore + viewsScore;
  return Number(total.toFixed(2));
}
