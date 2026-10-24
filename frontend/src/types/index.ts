export type PostStatus = "agendado" | "publicando" | "publicado" | "falhou" | "cancelado";

export interface ScheduledPost {
  id: string;
  accountId?: string;
  text: string;
  mediaPaths: string[];
  threadParts: string[];
  scheduledAt: string;
  status: PostStatus;
  tweetId?: string | null;
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  latestMetrics?: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views?: number | null;
  };
  account?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface TweetRankingItem {
  position: number;
  id: string;
  tweetId: string;
  text: string;
  publishedAt: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views?: number | null;
  };
  score: number;
  tweetUrl: string;
}

export interface AnalyticsOverview {
  period: "7d" | "30d" | "all";
  totals: {
    posts: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views: number | null;
    engagementScore: number;
    avgEngagement: number;
  };
  variations: {
    postsPercent: number;
    likesPercent: number;
    retweetsPercent: number;
    repliesPercent: number;
    avgEngagementPercent: number;
  };
  bestTimeToPost: {
    dayOfWeek: number;
    dayName: string;
    hour: number;
    formattedTime: string;
    avgScore: number;
  };
  heatmap: Array<{
    day: number;
    dayName: string;
    hour: number;
    postsCount: number;
    avgScore: number;
  }>;
}

export interface TwitterAccount {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  isActive: boolean;
  status: "connected" | "error" | "disconnected";
  lastError?: string | null;
  hasScrapingCredentials: boolean;
  hasApiKeys: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringWeights {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  views: number;
}

export interface McpStatusResponse {
  connected: boolean;
  connectionTest: {
    ok: boolean;
    message: string;
    username?: string;
  };
  activeAccount?: {
    id: string;
    username: string;
    displayName?: string;
    status: string;
    avatarUrl?: string;
    lastError?: string | null;
  };
  tools: Array<{
    name: string;
    description?: string;
  }>;
}
