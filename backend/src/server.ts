import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { McpClientManager } from "./mcp/client";
import { AccountsService } from "./modules/accounts/accounts.service";
import { SchedulerWorker } from "./workers/scheduler.worker";
import { AnalyticsWorker } from "./workers/analytics.worker";

async function bootstrap() {
  logger.info("Iniciando Dashboard Twitter/X API...");

  const mcpManager = McpClientManager.getInstance();
  const accountsService = new AccountsService();
  const schedulerWorker = new SchedulerWorker();
  const analyticsWorker = new AnalyticsWorker();

  // 1. Carrega conta ativa salva no banco (se existir)
  try {
    await accountsService.loadActiveAccount();
  } catch (err) {
    logger.warn("Aviso ao carregar conta ativa:", { error: String(err) });
  }

  // 2. Conecta ao servidor MCP
  try {
    await mcpManager.connect();
    logger.info("Servidor MCP Twitter inicializado e ferramentas inspecionadas.");
  } catch (err) {
    logger.warn("Servidor MCP não pôde conectar imediatamente (iniciando em modo de espera):", { error: String(err) });
  }

  // 3. Executa recuperação pós-crash de posts travados em 'publicando'
  try {
    await schedulerWorker.recoverStuckPosts();
  } catch (err) {
    logger.error("Erro ao recuperar posts travados:", err);
  }

  // 4. Inicia workers se habilitados
  if (env.SCHEDULER_ENABLED) {
    schedulerWorker.start();
  }
  if (env.ANALYTICS_CRON_ENABLED) {
    analyticsWorker.start();
  }

  // 5. Inicia o servidor HTTP
  const server = app.listen(env.PORT, () => {
    logger.info(`Servidor backend rodando com sucesso na porta ${env.PORT}!`);
    logger.info(`Health check disponível em: http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Encerrando servidor com segurança...");
    schedulerWorker.stop();
    await mcpManager.disconnect();
    server.close(() => {
      logger.info("Servidor HTTP finalizado.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  logger.error("Erro fatal ao iniciar aplicação:", err);
  process.exit(1);
});
