import cron from "node-cron";
import { prisma } from "../db/client";
import { TwitterProvider } from "../providers/twitter.provider";
import { McpTwitterProvider } from "../providers/mcp.provider";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export class AnalyticsWorker {
  private isRunning: boolean = false;
  private provider: TwitterProvider;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(provider?: TwitterProvider) {
    this.provider = provider || new McpTwitterProvider();
  }

  public setProvider(newProvider: TwitterProvider) {
    this.provider = newProvider;
  }

  /**
   * Coleta métricas recentes dos tweets e grava snapshots no banco
   */
  public async captureMetricsSnapshots(): Promise<number> {
    if (this.isRunning) {
      logger.debug("Analytics snapshot já está em andamento.");
      return 0;
    }

    this.isRunning = true;
    let savedSnapshots = 0;

    try {
      // Identifica o nome de usuário ativo
      const activeAccount = await prisma.account.findFirst({
        where: { isActive: true }
      });

      const username = activeAccount?.username || env.TWITTER_USERNAME;
      if (!username) {
        logger.debug("Nenhuma conta configurada para coleta de métricas de tweets.");
        this.isRunning = false;
        return 0;
      }

      logger.info(`Buscando tweets recentes de @${username} para atualização de métricas...`);
      const recentTweets = await this.provider.getUserTweets(username, 50);

      const capturedAt = new Date();

      for (const tweet of recentTweets) {
        if (!tweet.id) continue;

        // Verifica se o tweet já existe na tabela de scheduled_posts
        let post = await prisma.scheduledPost.findUnique({
          where: { tweetId: tweet.id }
        });

        // Se foi postado diretamente no Twitter (fora do agendador), registra na tabela para análise unificada
        if (!post) {
          post = await prisma.scheduledPost.create({
            data: {
              accountId: activeAccount?.id,
              text: tweet.text || "(Tweet sem texto)",
              scheduledAt: tweet.createdAt ? new Date(tweet.createdAt) : capturedAt,
              status: "publicado",
              tweetId: tweet.id,
              publishedAt: tweet.createdAt ? new Date(tweet.createdAt) : capturedAt,
              mediaPaths: "[]"
            }
          });
        }

        // Salva o snapshot de métricas
        await prisma.tweetMetricsSnapshot.create({
          data: {
            tweetId: tweet.id,
            capturedAt,
            likes: Number(tweet.metrics.likes || 0),
            retweets: Number(tweet.metrics.retweets || 0),
            replies: Number(tweet.metrics.replies || 0),
            quotes: Number(tweet.metrics.quotes || 0),
            views: tweet.metrics.views !== undefined && tweet.metrics.views !== null ? Number(tweet.metrics.views) : null
          }
        });

        savedSnapshots++;
      }

      logger.info(`Captura de métricas concluída: ${savedSnapshots} snapshots registrados.`);
    } catch (err: any) {
      logger.error("Erro ao executar coleta de métricas periódica:", err);
    } finally {
      this.isRunning = false;
    }

    return savedSnapshots;
  }

  /**
   * Inicia o cron a cada 30 minutos
   */
  public start(): void {
    if (this.cronJob) return;

    logger.info("Iniciando Analytics Worker (a cada 30 minutos)...");
    this.cronJob = cron.schedule("*/30 * * * *", async () => {
      await this.captureMetricsSnapshots();
    });
  }

  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("Analytics Worker parado.");
    }
  }
}
