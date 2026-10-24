import {
  TwitterProvider,
  PostTweetParams,
  TweetResult,
  CreateThreadParams,
  ThreadResult,
  TweetData,
  UserProfile
} from "./twitter.provider";
import { McpClientManager } from "../mcp/client";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export class McpTwitterProvider implements TwitterProvider {
  private mcpManager: McpClientManager;

  constructor() {
    this.mcpManager = McpClientManager.getInstance();
  }

  /**
   * Helper para extrair o texto de resposta do MCP
   */
  private extractTextFromMcpResponse(response: any): string {
    if (!response || !response.content) return "";
    const textItem = response.content.find((c: any) => c.type === "text");
    return textItem ? textItem.text : JSON.stringify(response);
  }

  /**
   * Publica tweet individual via tool 'post_tweet'
   */
  public async postTweet(params: PostTweetParams): Promise<TweetResult> {
    const mcpArgs: Record<string, any> = {
      text: params.text
    };

    if (params.replyToTweetId) {
      mcpArgs.reply_to_tweet_id = params.replyToTweetId;
    }

    if (params.quoteTweetId) {
      mcpArgs.quote_tweet_id = params.quoteTweetId;
    }

    if (params.media && params.media.length > 0) {
      mcpArgs.media = params.media.map((m) => ({
        data: m.data,
        media_type: m.mediaType
      }));
    }

    const response = await this.mcpManager.callTool("post_tweet", mcpArgs);
    const textResponse = this.extractTextFromMcpResponse(response);

    if (textResponse.startsWith("Error:") || textResponse.includes("Failed to post tweet")) {
      throw new Error(`Erro retornado pelo MCP Twitter: ${textResponse}`);
    }

    // Tenta extrair o tweet_id da resposta formatada pelo patch
    const matchId = textResponse.match(/ID:\s*([0-9]+)/i);
    let tweetId = matchId ? matchId[1] : undefined;

    // Se o tweetId não veio no texto (ex: se o scraper não devolveu no JSON),
    // busca os tweets mais recentes do usuário para localizar o ID do post recém-criado
    if (!tweetId && env.TWITTER_USERNAME) {
      try {
        const recentTweets = await this.getUserTweets(env.TWITTER_USERNAME, 3);
        const matched = recentTweets.find(t => t.text.trim() === params.text.trim());
        if (matched) {
          tweetId = matched.id;
        } else if (recentTweets.length > 0) {
          tweetId = recentTweets[0].id;
        }
      } catch (e) {
        logger.warn("Não foi possível resolver tweet_id via get_tweets fallback:", { error: String(e) });
      }
    }

    const finalTweetId = tweetId || `tweet_${Date.now()}`;

    return {
      tweetId: finalTweetId,
      text: params.text,
      rawResponse: textResponse
    };
  }

  /**
   * Cria thread encadeada via tool 'create_thread'
   */
  public async createThread(params: CreateThreadParams): Promise<ThreadResult> {
    if (!params.tweets || params.tweets.length < 2) {
      throw new Error("Uma thread no Twitter precisa conter pelo menos 2 tweets.");
    }

    const tweetsFormatted = params.tweets.map((t) => {
      const item: any = { text: t.text };
      if (t.media && t.media.length > 0) {
        item.media = t.media.map((m) => ({
          data: m.data,
          media_type: m.mediaType
        }));
      }
      return item;
    });

    const response = await this.mcpManager.callTool("create_thread", {
      tweets: tweetsFormatted
    });

    const textResponse = this.extractTextFromMcpResponse(response);
    if (textResponse.startsWith("Error:") || textResponse.includes("Failed to create thread")) {
      throw new Error(`Erro ao criar thread via MCP: ${textResponse}`);
    }

    // Procura "First tweet ID: <id>"
    const matchId = textResponse.match(/First tweet ID:\s*([0-9]+)/i);
    const firstTweetId = matchId ? matchId[1] : `thread_${Date.now()}`;

    return {
      firstTweetId,
      tweetIds: [firstTweetId],
      count: params.tweets.length,
      rawResponse: textResponse
    };
  }

  /**
   * Busca tweets de um usuário via tool 'get_tweets'
   */
  public async getUserTweets(username: string, count: number = 20): Promise<TweetData[]> {
    const cleanUsername = username.replace("@", "").trim();
    const response = await this.mcpManager.callTool("get_tweets", {
      username: cleanUsername,
      count: Math.min(count, 50)
    });

    const textResponse = this.extractTextFromMcpResponse(response);
    if (textResponse.startsWith("Error:")) {
      throw new Error(`Erro ao buscar tweets: ${textResponse}`);
    }

    try {
      const parsed = JSON.parse(textResponse);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((item: any) => ({
        id: String(item.id || item.tweetId || ""),
        text: String(item.text || ""),
        createdAt: item.created_at || item.createdAt || new Date().toISOString(),
        metrics: {
          likes: Number(item.metrics?.likes ?? item.likes ?? 0),
          retweets: Number(item.metrics?.retweets ?? item.retweets ?? 0),
          replies: Number(item.metrics?.replies ?? item.replies ?? 0),
          quotes: Number(item.metrics?.quotes ?? item.quotes ?? 0),
          views: item.metrics?.views !== undefined ? Number(item.metrics.views) : null
        },
        author: item.author ? {
          id: String(item.author.id || ""),
          username: String(item.author.username || cleanUsername),
          displayName: String(item.author.displayName || "")
        } : undefined
      }));
    } catch (parseErr) {
      logger.error("Erro ao analisar JSON retornado por get_tweets:", parseErr, { raw: textResponse });
      return [];
    }
  }

  /**
   * Obtém informações do perfil via tool 'get_profile'
   */
  public async getProfile(username: string): Promise<UserProfile> {
    const cleanUsername = username.replace("@", "").trim();
    const response = await this.mcpManager.callTool("get_profile", {
      username: cleanUsername
    });

    const textResponse = this.extractTextFromMcpResponse(response);
    if (textResponse.startsWith("Error:")) {
      throw new Error(`Erro ao buscar perfil: ${textResponse}`);
    }

    const parsed = JSON.parse(textResponse);
    return {
      id: String(parsed.id || ""),
      username: String(parsed.username || cleanUsername),
      displayName: String(parsed.displayName || parsed.name || cleanUsername),
      bio: parsed.bio || parsed.biography,
      location: parsed.location,
      avatar: parsed.avatar,
      metrics: parsed.metrics ? {
        tweets: Number(parsed.metrics.tweets || 0),
        followers: Number(parsed.metrics.followers || 0),
        following: Number(parsed.metrics.following || 0),
        likes: Number(parsed.metrics.likes || 0)
      } : undefined
    };
  }

  /**
   * Valida status da conexão
   */
  public async testConnection(): Promise<{ ok: boolean; message: string; username?: string }> {
    try {
      if (!this.mcpManager.isConnected()) {
        await this.mcpManager.connect();
      }

      const tools = this.mcpManager.getAllTools();
      if (tools.length === 0) {
        return {
          ok: false,
          message: "Servidor MCP conectado, mas nenhuma ferramenta disponível."
        };
      }

      // Se temos username configurado, testa get_profile
      const targetUser = env.TWITTER_USERNAME.trim();
      if (targetUser) {
        try {
          const profile = await this.getProfile(targetUser);
          return {
            ok: true,
            message: `Autenticado com sucesso no Twitter/X como @${profile.username}`,
            username: profile.username
          };
        } catch (profileError: any) {
          return {
            ok: false,
            message: `Servidor MCP online, mas erro de autenticação na conta: ${profileError.message}`
          };
        }
      }

      return {
        ok: true,
        message: `Servidor MCP conectado com ${tools.length} ferramentas prontas. Nenhuma conta configurada ainda.`
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `Falha na conexão MCP: ${err.message}`
      };
    }
  }
}
