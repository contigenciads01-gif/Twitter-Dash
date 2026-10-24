import cron from "node-cron";
import { prisma } from "../db/client";
import { TwitterProvider } from "../providers/twitter.provider";
import { McpTwitterProvider } from "../providers/mcp.provider";
import { PostsService } from "../modules/posts/posts.service";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export class SchedulerWorker {
  private isProcessing: boolean = false;
  private postsService: PostsService;
  private provider: TwitterProvider;
  private lastPublicationTime: number = 0;
  private minIntervalMs: number = env.MIN_POST_INTERVAL_SECONDS * 1000;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(provider?: TwitterProvider) {
    this.provider = provider || new McpTwitterProvider();
    this.postsService = new PostsService(this.provider);
  }

  public setProvider(newProvider: TwitterProvider) {
    this.provider = newProvider;
    this.postsService.setProvider(newProvider);
  }

  public setMinIntervalSeconds(seconds: number) {
    this.minIntervalMs = seconds * 1000;
  }

  /**
   * Recuperação no boot do servidor:
   * 1. Recupera posts travados em "publicando" (ex: crash ou restart repentino).
   * 2. Se o post já possui tweet_id, marca como "publicado".
   * 3. Se não possui tweet_id e tem menos de 3 tentativas, volta para "agendado".
   */
  public async recoverStuckPosts(): Promise<number> {
    logger.info("Verificando se existem posts travados em 'publicando'...");

    const stuckPosts = await prisma.scheduledPost.findMany({
      where: {
        status: "publicando"
      }
    });

    let recovered = 0;
    for (const post of stuckPosts) {
      if (post.tweetId) {
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: "publicado", publishedAt: post.publishedAt || new Date() }
        });
        logger.info(`Post ID ${post.id} recuperado e marcado como 'publicado' (tweetId encontrado: ${post.tweetId}).`);
      } else {
        const nextAttempts = post.attempts + 1;
        if (nextAttempts >= 3) {
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              status: "falhou",
              attempts: nextAttempts,
              lastError: "Processo interrompido inesperadamente durante a publicação."
            }
          });
          logger.warn(`Post ID ${post.id} atingiu limite de tentativas após recuperação e foi marcado como 'falhou'.`);
        } else {
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              status: "agendado",
              attempts: nextAttempts,
              lastError: "Servidor reiniciado durante publicação; agendado para nova tentativa."
            }
          });
          logger.info(`Post ID ${post.id} destravado e retornado para fila com status 'agendado'.`);
        }
      }
      recovered++;
    }

    if (recovered > 0) {
      logger.info(`Total de ${recovered} posts recuperados no boot.`);
    }

    return recovered;
  }

  /**
   * Execução periódica a cada minuto
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) {
      logger.debug("Scheduler já está em execução neste tick, aguardando próximo ciclo.");
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();

      // Busca posts agendados cuja data já foi atingida
      const duePosts = await prisma.scheduledPost.findMany({
        where: {
          status: "agendado",
          scheduledAt: { lte: now }
        },
        orderBy: { scheduledAt: "asc" }
      });

      if (duePosts.length === 0) {
        this.isProcessing = false;
        return;
      }

      logger.info(`Scheduler encontrou ${duePosts.length} post(s) para publicar.`);

      for (const post of duePosts) {
        // Respeita intervalo mínimo entre publicações para evitar ban/bloqueio
        const elapsedSinceLast = Date.now() - this.lastPublicationTime;
        if (this.lastPublicationTime > 0 && elapsedSinceLast < this.minIntervalMs) {
          const waitMs = this.minIntervalMs - elapsedSinceLast;
          logger.info(`Respeitando intervalo de proteção (${waitMs}ms restantes). Pausando antes de publicar próximo post...`);
          await new Promise((r) => setTimeout(r, waitMs));
        }

        // Lock atômico: atualiza status para 'publicando' somente se ainda for 'agendado'
        const locked = await prisma.scheduledPost.updateMany({
          where: {
            id: post.id,
            status: "agendado"
          },
          data: {
            status: "publicando"
          }
        });

        // Se locked.count === 0, outra thread/instância já capturou este post
        if (locked.count === 0) {
          continue;
        }

        await this.publishWithRetry(post);
        this.lastPublicationTime = Date.now();
      }
    } catch (err: any) {
      logger.error("Erro durante execução do ciclo do Scheduler:", err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Publica o post e aplica backoff exponencial em caso de erro
   */
  public async publishWithRetry(post: any): Promise<void> {
    try {
      await this.postsService.executePublish(post);
    } catch (error: any) {
      const nextAttempts = (post.attempts || 0) + 1;
      const errorMessage = error?.message || "Erro desconhecido ao publicar no Twitter";
      logger.error(`Falha ao publicar post ID ${post.id} (tentativa ${nextAttempts}/3):`, error);

      if (nextAttempts >= 3) {
        // Esgotou tentativas: marca como 'falhou'
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "falhou",
            attempts: nextAttempts,
            lastError: errorMessage
          }
        });
        logger.error(`Post ID ${post.id} falhou definitivamente após ${nextAttempts} tentativas.`);
      } else {
        // Backoff exponencial: 1ª tentativa = +30s, 2ª tentativa = +120s
        const backoffSeconds = nextAttempts === 1 ? 30 : 120;
        const nextScheduledAt = new Date(Date.now() + backoffSeconds * 1000);

        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "agendado",
            attempts: nextAttempts,
            lastError: errorMessage,
            scheduledAt: nextScheduledAt
          }
        });
        logger.warn(`Post ID ${post.id} reagendado para daqui a ${backoffSeconds}s (tentativa ${nextAttempts}/3).`);
      }
    }
  }

  /**
   * Inicia o cron do Scheduler
   */
  public start(): void {
    if (this.cronJob) return;

    logger.info("Iniciando Scheduler Worker do Twitter/X (a cada minuto)...");
    this.cronJob = cron.schedule("* * * * *", async () => {
      await this.processQueue();
    });
  }

  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("Scheduler Worker parado.");
    }
  }
}
