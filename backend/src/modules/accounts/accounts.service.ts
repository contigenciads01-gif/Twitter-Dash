import { prisma } from "../../db/client";
import { McpClientManager } from "../../mcp/client";
import { McpTwitterProvider } from "../../providers/mcp.provider";
import { AppError } from "../../utils/errors";
import { logger } from "../../utils/logger";

export interface CreateAccountDTO {
  type: "scraping" | "api";
  username: string;
  password?: string;
  email?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessSecret?: string;
}

export class AccountsService {
  private mcpManager: McpClientManager;
  private mcpProvider: McpTwitterProvider;

  constructor() {
    this.mcpManager = McpClientManager.getInstance();
    this.mcpProvider = new McpTwitterProvider();
  }

  /**
   * Adiciona e autoriza uma nova conta do Twitter/X
   */
  public async addAccount(data: CreateAccountDTO) {
    const cleanUsername = data.username.replace("@", "").trim();
    if (!cleanUsername) {
      throw new AppError("O nome de usuário do Twitter é obrigatório.", 400, "INVALID_USERNAME");
    }

    logger.info(`Iniciando autorização e conexão da conta @${cleanUsername}...`);

    // Atualiza temporariamente as credenciais no gerenciador MCP para teste
    const creds: Record<string, string> = {
      TWITTER_USERNAME: cleanUsername
    };

    if (data.type === "scraping") {
      if (!data.password) {
        throw new AppError("Senha do Twitter é obrigatória para login via scraping.", 400, "MISSING_PASSWORD");
      }
      creds.TWITTER_PASSWORD = data.password;
      if (data.email) creds.TWITTER_EMAIL = data.email;
    } else {
      if (!data.apiKey || !data.accessToken) {
        throw new AppError("API Key e Access Token são obrigatórios para conexão oficial.", 400, "MISSING_API_KEYS");
      }
      creds.TWITTER_API_KEY = data.apiKey;
      creds.TWITTER_API_SECRET_KEY = data.apiSecret || "";
      creds.TWITTER_ACCESS_TOKEN = data.accessToken;
      creds.TWITTER_ACCESS_TOKEN_SECRET = data.accessSecret || "";
    }

    this.mcpManager.updateCredentials(creds);

    let profileData: any = null;
    let connectionError: string | null = null;

    try {
      // Reconecta o processo filho do MCP com as credenciais fornecidas
      await this.mcpManager.connect();

      // Testa a obtenção do perfil com a tool get_profile
      profileData = await this.mcpProvider.getProfile(cleanUsername);
      logger.info(`Conta @${cleanUsername} verificada com sucesso via MCP!`);
    } catch (err: any) {
      logger.warn(`Não foi possível validar o perfil imediatamente no MCP: ${err.message}`);
      connectionError = err.message;
      // Não bloqueia caso o usuário queira salvar credenciais para o worker tentar depois,
      // mas salva com status 'error'
    }

    // Desativa outras contas se esta for definida como ativa
    await prisma.account.updateMany({
      data: { isActive: false }
    });

    const account = await prisma.account.upsert({
      where: { username: cleanUsername },
      create: {
        username: cleanUsername,
        displayName: profileData?.displayName || cleanUsername,
        avatarUrl: profileData?.avatar || null,
        email: data.email || null,
        password: data.password || null,
        apiKey: data.apiKey || null,
        apiSecret: data.apiSecret || null,
        accessToken: data.accessToken || null,
        accessSecret: data.accessSecret || null,
        isActive: true,
        status: connectionError ? "error" : "connected",
        lastError: connectionError
      },
      update: {
        displayName: profileData?.displayName || cleanUsername,
        avatarUrl: profileData?.avatar || null,
        email: data.email || null,
        password: data.password || null,
        apiKey: data.apiKey || null,
        apiSecret: data.apiSecret || null,
        accessToken: data.accessToken || null,
        accessSecret: data.accessSecret || null,
        isActive: true,
        status: connectionError ? "error" : "connected",
        lastError: connectionError
      }
    });

    return {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      isActive: account.isActive,
      status: account.status,
      lastError: account.lastError,
      verifiedProfile: profileData
    };
  }

  /**
   * Lista todas as contas cadastradas com credenciais sanitizadas
   */
  public async listAccounts() {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" }
    });

    return accounts.map((acc) => ({
      id: acc.id,
      username: acc.username,
      displayName: acc.displayName,
      avatarUrl: acc.avatarUrl,
      email: acc.email,
      isActive: acc.isActive,
      status: acc.status,
      lastError: acc.lastError,
      hasScrapingCredentials: Boolean(acc.password),
      hasApiKeys: Boolean(acc.apiKey && acc.accessToken),
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt
    }));
  }

  /**
   * Alterna a conta ativa
   */
  public async setActiveAccount(id: string) {
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new AppError("Conta não encontrada.", 404, "ACCOUNT_NOT_FOUND");
    }

    await prisma.account.updateMany({
      data: { isActive: false }
    });

    const updated = await prisma.account.update({
      where: { id },
      data: { isActive: true }
    });

    // Atualiza credenciais no processo MCP
    const creds: Record<string, string> = {
      TWITTER_USERNAME: updated.username
    };
    if (updated.password) creds.TWITTER_PASSWORD = updated.password;
    if (updated.email) creds.TWITTER_EMAIL = updated.email;
    if (updated.apiKey) creds.TWITTER_API_KEY = updated.apiKey;
    if (updated.apiSecret) creds.TWITTER_API_SECRET_KEY = updated.apiSecret;
    if (updated.accessToken) creds.TWITTER_ACCESS_TOKEN = updated.accessToken;
    if (updated.accessSecret) creds.TWITTER_ACCESS_TOKEN_SECRET = updated.accessSecret;

    this.mcpManager.updateCredentials(creds);
    try {
      await this.mcpManager.connect();
    } catch (_) {}

    return updated;
  }

  /**
   * Remove uma conta
   */
  public async deleteAccount(id: string) {
    return prisma.account.delete({ where: { id } });
  }

  /**
   * Carrega a conta ativa na inicialização do servidor
   */
  public async loadActiveAccount() {
    const activeAccount = await prisma.account.findFirst({
      where: { isActive: true }
    });

    if (activeAccount) {
      logger.info(`Carregando conta ativa @${activeAccount.username} para o processo MCP...`);
      const creds: Record<string, string> = {
        TWITTER_USERNAME: activeAccount.username
      };
      if (activeAccount.password) creds.TWITTER_PASSWORD = activeAccount.password;
      if (activeAccount.email) creds.TWITTER_EMAIL = activeAccount.email;
      if (activeAccount.apiKey) creds.TWITTER_API_KEY = activeAccount.apiKey;
      if (activeAccount.apiSecret) creds.TWITTER_API_SECRET_KEY = activeAccount.apiSecret;
      if (activeAccount.accessToken) creds.TWITTER_ACCESS_TOKEN = activeAccount.accessToken;
      if (activeAccount.accessSecret) creds.TWITTER_ACCESS_TOKEN_SECRET = activeAccount.accessSecret;

      this.mcpManager.updateCredentials(creds);
    }
  }
}
