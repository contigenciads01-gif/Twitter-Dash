import fs from "fs";
import path from "path";
import { prisma } from "../../db/client";
import { AppError } from "../../utils/errors";
import { TwitterProvider, MediaAttachment } from "../../providers/twitter.provider";
import { McpTwitterProvider } from "../../providers/mcp.provider";
import { logger } from "../../utils/logger";

export interface CreatePostInput {
  text: string;
  scheduledAt: string;
  mediaPaths?: string[];
  threadParts?: string[];
  accountId?: string;
}

export interface UpdatePostInput {
  text?: string;
  scheduledAt?: string;
  mediaPaths?: string[];
  threadParts?: string[];
}

export interface PostFilters {
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export class PostsService {
  private provider: TwitterProvider;

  constructor(provider?: TwitterProvider) {
    this.provider = provider || new McpTwitterProvider();
  }

  public setProvider(newProvider: TwitterProvider) {
    this.provider = newProvider;
  }

  /**
   * Converte caminhos de mídia armazenados em anexo Base64 para envio ao Twitter
   */
  public prepareMediaAttachments(mediaPathsJson: string): MediaAttachment[] {
    try {
      const paths: string[] = JSON.parse(mediaPathsJson || "[]");
      const attachments: MediaAttachment[] = [];

      for (const relPath of paths) {
        // Resolve o arquivo no disco (pasta uploads)
        const fullPath = path.isAbsolute(relPath)
          ? relPath
          : path.resolve(process.cwd(), relPath);

        if (fs.existsSync(fullPath)) {
          const fileBuffer = fs.readFileSync(fullPath);
          const ext = path.extname(fullPath).toLowerCase();
          let mediaType = "image/jpeg";
          if (ext === ".png") mediaType = "image/png";
          else if (ext === ".gif") mediaType = "image/gif";
          else if (ext === ".mp4") mediaType = "video/mp4";

          attachments.push({
            data: fileBuffer.toString("base64"),
            mediaType
          });
        }
      }
      return attachments;
    } catch (e) {
      logger.error("Erro ao preparar anexos de mídia:", e);
      return [];
    }
  }

  /**
   * Cria um novo post agendado
   */
  public async createPost(input: CreatePostInput) {
    // Busca a conta ativa se accountId não for fornecido
    let targetAccountId = input.accountId;
    if (!targetAccountId) {
      const activeAccount = await prisma.account.findFirst({
        where: { isActive: true }
      });
      targetAccountId = activeAccount?.id;
    }

    const post = await prisma.scheduledPost.create({
      data: {
        text: input.text,
        scheduledAt: new Date(input.scheduledAt),
        mediaPaths: JSON.stringify(input.mediaPaths || []),
        threadParts: input.threadParts && input.threadParts.length > 0 ? JSON.stringify(input.threadParts) : null,
        status: "agendado",
        accountId: targetAccountId
      }
    });

    return post;
  }

  /**
   * Lista posts com filtros opcionais
   */
  public async getPosts(filters: PostFilters) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.from || filters.to) {
      where.scheduledAt = {};
      if (filters.from) {
        where.scheduledAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.scheduledAt.lte = new Date(filters.to);
      }
    }

    const posts = await prisma.scheduledPost.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      take: filters.limit || 100,
      skip: filters.offset || 0,
      include: {
        account: {
          select: { id: true, username: true, displayName: true, avatarUrl: true }
        },
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 1
        }
      }
    });

    return posts.map((p) => ({
      ...p,
      mediaPaths: JSON.parse(p.mediaPaths || "[]"),
      threadParts: p.threadParts ? JSON.parse(p.threadParts) : [],
      latestMetrics: p.snapshots[0] || null
    }));
  }

  public async getPostById(id: string) {
    const post = await prisma.scheduledPost.findUnique({
      where: { id },
      include: {
        account: true,
        snapshots: {
          orderBy: { capturedAt: "desc" }
        }
      }
    });

    if (!post) {
      throw new AppError("Post não encontrado.", 404, "POST_NOT_FOUND");
    }

    return {
      ...post,
      mediaPaths: JSON.parse(post.mediaPaths || "[]"),
      threadParts: post.threadParts ? JSON.parse(post.threadParts) : []
    };
  }

  /**
   * Atualiza ou reagenda um post pendente
   */
  public async updatePost(id: string, input: UpdatePostInput) {
    const post = await prisma.scheduledPost.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post não encontrado.", 404, "POST_NOT_FOUND");
    }

    if (post.status === "publicado" || post.status === "publicando") {
      throw new AppError("Não é possível alterar um post que já foi publicado ou está em publicação.", 400, "CANNOT_EDIT_POST");
    }

    const updateData: any = {};
    if (input.text !== undefined) updateData.text = input.text;
    if (input.scheduledAt !== undefined) updateData.scheduledAt = new Date(input.scheduledAt);
    if (input.mediaPaths !== undefined) updateData.mediaPaths = JSON.stringify(input.mediaPaths);
    if (input.threadParts !== undefined) updateData.threadParts = JSON.stringify(input.threadParts);

    // Se estava em erro e foi editado/reagendado, reseta para agendado
    if (post.status === "falhou" || post.status === "cancelado") {
      updateData.status = "agendado";
      updateData.attempts = 0;
      updateData.lastError = null;
    }

    const updated = await prisma.scheduledPost.update({
      where: { id },
      data: updateData
    });

    return {
      ...updated,
      mediaPaths: JSON.parse(updated.mediaPaths || "[]"),
      threadParts: updated.threadParts ? JSON.parse(updated.threadParts) : []
    };
  }

  /**
   * Cancela um post agendado
   */
  public async cancelPost(id: string) {
    const post = await prisma.scheduledPost.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post não encontrado.", 404, "POST_NOT_FOUND");
    }

    if (post.status === "publicado" || post.status === "publicando") {
      throw new AppError("Não é possível cancelar um post já publicado ou em publicação.", 400, "CANNOT_CANCEL_POST");
    }

    return prisma.scheduledPost.update({
      where: { id },
      data: { status: "cancelado" }
    });
  }

  /**
   * Tenta publicar novamente um post que falhou
   */
  public async retryPost(id: string) {
    const post = await prisma.scheduledPost.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post não encontrado.", 404, "POST_NOT_FOUND");
    }

    return prisma.scheduledPost.update({
      where: { id },
      data: {
        status: "agendado",
        attempts: 0,
        lastError: null,
        scheduledAt: new Date() // Imediato
      }
    });
  }

  /**
   * Executa a publicação de um post diretamente (usado pelo Worker ou pelo botão 'Publicar agora')
   */
  public async executePublish(post: any): Promise<void> {
    logger.info(`Executando publicação do post ID ${post.id}...`);

    const mediaAttachments = this.prepareMediaAttachments(post.mediaPaths);
    const threadParts: string[] = post.threadParts ? JSON.parse(post.threadParts) : [];

    let publishedTweetId = "";

    if (threadParts.length > 0) {
      // É uma thread! Combina o texto principal como primeiro tweet e as partes subsequentes
      const allTweets = [
        { text: post.text, media: mediaAttachments },
        ...threadParts.map((t) => ({ text: t }))
      ];

      const res = await this.provider.createThread({ tweets: allTweets });
      publishedTweetId = res.firstTweetId;
    } else {
      // Tweet simples
      const res = await this.provider.postTweet({
        text: post.text,
        media: mediaAttachments
      });
      publishedTweetId = res.tweetId;
    }

    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: "publicado",
        tweetId: publishedTweetId,
        publishedAt: new Date(),
        lastError: null
      }
    });

    // Cria snapshot inicial de métricas zeradas
    try {
      await prisma.tweetMetricsSnapshot.create({
        data: {
          tweetId: publishedTweetId,
          capturedAt: new Date(),
          likes: 0,
          retweets: 0,
          replies: 0,
          quotes: 0,
          views: 0
        }
      });
    } catch (_) {}

    logger.info(`Post ID ${post.id} publicado com sucesso! Tweet ID: ${publishedTweetId}`);
  }
}
