import {
  TwitterProvider,
  PostTweetParams,
  TweetResult,
  CreateThreadParams,
  ThreadResult,
  TweetData,
  UserProfile
} from "./twitter.provider";

export class MockTwitterProvider implements TwitterProvider {
  public tweetsStore: TweetData[] = [
    {
      id: "1890000000000000001",
      text: "Lançamento oficial do nosso novo dashboard inteligente para Twitter/X! 🚀 Conectado com sucesso.",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      metrics: {
        likes: 42,
        retweets: 12,
        replies: 7,
        quotes: 3,
        views: 1250
      }
    },
    {
      id: "1890000000000000002",
      text: "Como programar posts com alta performance usando IA e MCP? Veja esta análise completa 📊🧵",
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      metrics: {
        likes: 95,
        retweets: 34,
        replies: 15,
        quotes: 8,
        views: 4320
      }
    }
  ];

  public shouldFail: boolean = false;
  public failError: string = "Falha simulada na API do Twitter";

  public async postTweet(params: PostTweetParams): Promise<TweetResult> {
    if (this.shouldFail) {
      throw new Error(this.failError);
    }

    const tweetId = `mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newTweet: TweetData = {
      id: tweetId,
      text: params.text,
      createdAt: new Date().toISOString(),
      metrics: {
        likes: 0,
        retweets: 0,
        replies: 0,
        quotes: 0,
        views: 0
      }
    };
    this.tweetsStore.unshift(newTweet);

    return {
      tweetId,
      text: params.text,
      rawResponse: { success: true, id: tweetId }
    };
  }

  public async createThread(params: CreateThreadParams): Promise<ThreadResult> {
    if (this.shouldFail) {
      throw new Error(this.failError);
    }

    const firstTweetId = `mock_thread_${Date.now()}_0`;
    const tweetIds = params.tweets.map((t, idx) => {
      const id = idx === 0 ? firstTweetId : `mock_thread_${Date.now()}_${idx}`;
      this.tweetsStore.unshift({
        id,
        text: t.text,
        createdAt: new Date().toISOString(),
        metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0 }
      });
      return id;
    });

    return {
      firstTweetId,
      tweetIds,
      count: params.tweets.length,
      rawResponse: { success: true, count: params.tweets.length }
    };
  }

  public async getUserTweets(username: string, count: number = 20): Promise<TweetData[]> {
    return this.tweetsStore.slice(0, count);
  }

  public async getProfile(username: string): Promise<UserProfile> {
    return {
      id: "999999999",
      username: username || "thiago_dev",
      displayName: "Thiago Developer",
      bio: "Tech Lead & Full Stack Engineer | X / Twitter Automation",
      location: "São Paulo, Brasil",
      metrics: {
        tweets: this.tweetsStore.length,
        followers: 1250,
        following: 340,
        likes: 890
      }
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message: string; username?: string }> {
    return {
      ok: true,
      message: "Provedor Mock conectado com sucesso (Modo de Testes e Desenvolvimento)",
      username: "thiago_dev"
    };
  }
}
