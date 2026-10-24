/**
 * Interface abstrata para provedores do Twitter/X.
 * Permite alternar perfeitamente entre o servidor MCP (scraping)
 * e a API Oficial do X (OAuth 2.0 / API v2).
 */

export interface MediaAttachment {
  data: string; // Base64
  mediaType: string; // ex: 'image/jpeg', 'image/png', 'video/mp4'
}

export interface PostTweetParams {
  text: string;
  media?: MediaAttachment[];
  replyToTweetId?: string;
  quoteTweetId?: string;
}

export interface TweetResult {
  tweetId: string;
  text: string;
  rawResponse?: any;
}

export interface CreateThreadParams {
  tweets: Array<{
    text: string;
    media?: MediaAttachment[];
  }>;
}

export interface ThreadResult {
  firstTweetId: string;
  tweetIds: string[];
  count: number;
  rawResponse?: any;
}

export interface TweetMetrics {
  likes: number;
  retweets: number;
  replies: number;
  quotes?: number;
  views?: number | null;
}

export interface TweetData {
  id: string;
  text: string;
  createdAt?: string | Date;
  metrics: TweetMetrics;
  author?: {
    id: string;
    username: string;
    displayName: string;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  location?: string;
  avatar?: string;
  metrics?: {
    tweets: number;
    followers: number;
    following: number;
    likes: number;
  };
}

export interface TwitterProvider {
  /**
   * Publica um tweet individual com suporte a texto e mídia opcional
   */
  postTweet(params: PostTweetParams): Promise<TweetResult>;

  /**
   * Publica uma sequência/thread de tweets encadeados
   */
  createThread(params: CreateThreadParams): Promise<ThreadResult>;

  /**
   * Obtém os tweets mais recentes de uma conta
   */
  getUserTweets(username: string, count?: number): Promise<TweetData[]>;

  /**
   * Obtém o perfil de um usuário
   */
  getProfile(username: string): Promise<UserProfile>;

  /**
   * Testa e valida a conexão ativa
   */
  testConnection(): Promise<{ ok: boolean; message: string; username?: string }>;
}
