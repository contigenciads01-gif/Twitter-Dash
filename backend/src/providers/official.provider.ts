import {
  TwitterProvider,
  PostTweetParams,
  TweetResult,
  CreateThreadParams,
  ThreadResult,
  TweetData,
  UserProfile
} from "./twitter.provider";
import { logger } from "../utils/logger";

/**
 * Provedor para a API Oficial do X (Twitter Developer API v2).
 * Deixa a arquitetura pronta para migração caso o scraping via MCP se torne instável.
 */
export class OfficialXApiProvider implements TwitterProvider {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessSecret: string;

  constructor(config?: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    accessSecret?: string;
  }) {
    this.apiKey = config?.apiKey || process.env.TWITTER_API_KEY || "";
    this.apiSecret = config?.apiSecret || process.env.TWITTER_API_SECRET_KEY || "";
    this.accessToken = config?.accessToken || process.env.TWITTER_ACCESS_TOKEN || "";
    this.accessSecret = config?.accessSecret || process.env.TWITTER_ACCESS_TOKEN_SECRET || "";
  }

  public async postTweet(params: PostTweetParams): Promise<TweetResult> {
    logger.info("Executando postTweet via OfficialXApiProvider (OAuth 1.0a / 2.0)");
    // Estrutura pronta para chamada com 'twitter-api-v2' ou fetch nativo
    throw new Error("OfficialXApiProvider: Configure suas credenciais da API Oficial de Desenvolvedor do X para utilizar este provedor.");
  }

  public async createThread(params: CreateThreadParams): Promise<ThreadResult> {
    logger.info("Executando createThread via OfficialXApiProvider");
    throw new Error("OfficialXApiProvider: Não implementado com credenciais atuais.");
  }

  public async getUserTweets(username: string, count?: number): Promise<TweetData[]> {
    logger.info(`Buscando tweets de @${username} via OfficialXApiProvider`);
    throw new Error("OfficialXApiProvider: Não implementado com credenciais atuais.");
  }

  public async getProfile(username: string): Promise<UserProfile> {
    logger.info(`Buscando perfil de @${username} via OfficialXApiProvider`);
    throw new Error("OfficialXApiProvider: Não implementado com credenciais atuais.");
  }

  public async testConnection(): Promise<{ ok: boolean; message: string; username?: string }> {
    const hasKeys = Boolean(this.apiKey && this.accessToken);
    return {
      ok: hasKeys,
      message: hasKeys
        ? "API Oficial do X configurada com credenciais."
        : "Credenciais da API Oficial do X incompletas."
    };
  }
}
