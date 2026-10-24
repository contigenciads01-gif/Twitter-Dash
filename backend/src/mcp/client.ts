import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import fs from "fs";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: any;
}

export class McpClientManager {
  private static instance: McpClientManager;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private toolsCache: Map<string, ToolDefinition> = new Map();
  private credentialsOverride: Record<string, string> = {};

  private constructor() {}

  public static getInstance(): McpClientManager {
    if (!McpClientManager.instance) {
      McpClientManager.instance = new McpClientManager();
    }
    return McpClientManager.instance;
  }

  /**
   * Permite atualizar dinamicamente as credenciais da conta conectada via dashboard
   */
  public updateCredentials(credentials: Record<string, string>) {
    this.credentialsOverride = { ...this.credentialsOverride, ...credentials };
    logger.info("Credenciais do Twitter atualizadas para o processo MCP.");
  }

  /**
   * Conecta ao servidor MCP através de stdio
   */
  public async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      await this.disconnect();

      const serverScriptPath = path.resolve(process.cwd(), env.MCP_SERVER_PATH);
      if (!fs.existsSync(serverScriptPath)) {
        throw new Error(`Arquivo do servidor MCP não encontrado em: ${serverScriptPath}`);
      }

      const mergedEnv: Record<string, string> = {
        ...process.env,
        TWITTER_USERNAME: this.credentialsOverride.TWITTER_USERNAME || env.TWITTER_USERNAME,
        TWITTER_PASSWORD: this.credentialsOverride.TWITTER_PASSWORD || env.TWITTER_PASSWORD,
        TWITTER_EMAIL: this.credentialsOverride.TWITTER_EMAIL || env.TWITTER_EMAIL,
        TWITTER_API_KEY: this.credentialsOverride.TWITTER_API_KEY || env.TWITTER_API_KEY,
        TWITTER_API_SECRET_KEY: this.credentialsOverride.TWITTER_API_SECRET_KEY || env.TWITTER_API_SECRET_KEY,
        TWITTER_ACCESS_TOKEN: this.credentialsOverride.TWITTER_ACCESS_TOKEN || env.TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_TOKEN_SECRET: this.credentialsOverride.TWITTER_ACCESS_TOKEN_SECRET || env.TWITTER_ACCESS_TOKEN_SECRET,
      };

      logger.info("Iniciando processo filho do servidor MCP Twitter...", {
        serverScriptPath,
        hasUsername: Boolean(mergedEnv.TWITTER_USERNAME),
        hasApiKey: Boolean(mergedEnv.TWITTER_API_KEY)
      });

      this.transport = new StdioClientTransport({
        command: "node",
        args: [serverScriptPath],
        env: mergedEnv
      });

      this.client = new Client(
        {
          name: "twitter-dash-backend-client",
          version: "1.0.0"
        },
        {
          capabilities: {}
        }
      );

      // Tratamento de desconexão ou erro do processo
      this.transport.onerror = (error) => {
        logger.error("Erro no transporte stdio MCP:", error);
        this.scheduleReconnect();
      };

      this.transport.onclose = () => {
        logger.warn("Conexão stdio do servidor MCP foi fechada. Agendando reconexão...");
        this.scheduleReconnect();
      };

      await this.client.connect(this.transport);
      logger.info("Cliente MCP conectado via stdio com sucesso.");

      // Inspeciona e armazena em cache as ferramentas reais
      await this.inspectTools();

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      logger.error("Falha ao inicializar conexão com servidor MCP Twitter:", error);
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Executa listTools() no servidor MCP e salva os schemas reais
   */
  public async inspectTools(): Promise<Map<string, ToolDefinition>> {
    if (!this.client) {
      throw new Error("Cliente MCP não está conectado.");
    }

    try {
      const result = await this.client.listTools();
      this.toolsCache.clear();

      for (const tool of result.tools) {
        this.toolsCache.set(tool.name, {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      }

      logger.info(`Tools descobertas dinamicamente no MCP (${this.toolsCache.size} ferramentas):`, {
        tools: Array.from(this.toolsCache.keys())
      });

      return this.toolsCache;
    } catch (error) {
      logger.error("Erro ao listar ferramentas do MCP via listTools():", error);
      throw error;
    }
  }

  /**
   * Executa uma tool no MCP pelo nome real e parâmetros
   */
  public async callTool(name: string, args: Record<string, any>): Promise<any> {
    if (!this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error("Cliente MCP indisponível após tentativa de conexão.");
    }

    // Verifica se a tool existe na lista descoberta
    if (this.toolsCache.size > 0 && !this.toolsCache.has(name)) {
      logger.warn(`Ferramenta '${name}' não encontrada na lista atual. Tentando invocar mesmo assim.`);
    }

    logger.debug(`Chamando tool MCP '${name}'`, { args });

    try {
      const response = await this.client.callTool({
        name,
        arguments: args
      });

      return response;
    } catch (error) {
      logger.error(`Erro ao executar tool '${name}' no MCP:`, error, { args });
      throw error;
    }
  }

  /**
   * Retorna os detalhes de uma ferramenta inspecionada
   */
  public getTool(name: string): ToolDefinition | undefined {
    return this.toolsCache.get(name);
  }

  /**
   * Retorna todas as ferramentas conhecidas
   */
  public getAllTools(): ToolDefinition[] {
    return Array.from(this.toolsCache.values());
  }

  public isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Reconexão automática resiliente com debounce
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    const delayMs = 5000;
    logger.info(`Agendando reconexão do servidor MCP em ${delayMs / 1000}s...`);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      try {
        await this.connect();
      } catch (err) {
        logger.error("Tentativa de reconexão automática falhou:", err);
      }
    }, delayMs);
  }

  /**
   * Fecha os recursos atuais
   */
  public async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      try {
        await this.client.close();
      } catch (_) {}
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (_) {}
      this.transport = null;
    }
  }
}
