import { McpClientManager } from "./client";
import { McpTwitterProvider } from "../providers/mcp.provider";
import { logger } from "../utils/logger";

async function runMcpDiagnostics() {
  console.log("\n========================================================");
  console.log("   DIAGNÓSTICO E INSPEÇÃO DE CONEXÃO MCP TWITTER/X");
  console.log("========================================================\n");

  const manager = McpClientManager.getInstance();

  try {
    console.log("1. Tentando conectar ao processo filho twitter-mcp-server via stdio...");
    await manager.connect();
    console.log("-> Conexão estabelecida com sucesso!");

    console.log("\n2. Executando listTools() no servidor MCP...");
    const tools = await manager.inspectTools();
    console.log(`-> Total de ${tools.size} ferramentas encontradas:\n`);

    const requiredTools = ["post_tweet", "create_thread", "get_tweets", "get_profile"];

    for (const [name, def] of tools.entries()) {
      const isReq = requiredTools.includes(name) ? " [ESSENCIAL]" : "";
      console.log(` * Tool: ${name}${isReq}`);
      console.log(`   Descrição: ${def.description || "N/A"}`);
      console.log(`   Parâmetros:`, JSON.stringify(def.inputSchema?.properties || {}, null, 2));
      console.log("--------------------------------------------------------");
    }

    console.log("\n3. Validando ferramentas essenciais:");
    let allPresent = true;
    for (const req of requiredTools) {
      if (tools.has(req)) {
        console.log(`   [OK] Ferramenta '${req}' presente.`);
      } else {
        console.log(`   [FALHA] Ferramenta '${req}' AUSENTE!`);
        allPresent = false;
      }
    }

    console.log("\n4. Testando instância de McpTwitterProvider:");
    const provider = new McpTwitterProvider();
    const status = await provider.testConnection();
    console.log(`   Status do Provedor: ${status.ok ? "ONLINE" : "OFFLINE"}`);
    console.log(`   Mensagem: ${status.message}`);

    if (allPresent) {
      console.log("\nETAPA (A) CONCLUÍDA COM SUCESSO: MCP conectado, ferramentas mapeadas com schemas reais!");
    } else {
      console.warn("\nATENÇÃO: Nem todas as ferramentas essenciais foram encontradas.");
    }
  } catch (err: any) {
    logger.error("Falha ao rodar diagnóstico do MCP:", err);
  } finally {
    await manager.disconnect();
    console.log("\nConexão MCP fechada. Processo finalizado.");
    process.exit(0);
  }
}

runMcpDiagnostics();
