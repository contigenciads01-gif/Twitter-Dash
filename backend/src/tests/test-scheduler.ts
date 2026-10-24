import { prisma } from "../db/client";
import { MockTwitterProvider } from "../providers/mock.provider";
import { SchedulerWorker } from "../workers/scheduler.worker";
import { PostsService } from "../modules/posts/posts.service";
import { validateTweetText } from "../utils/twitter-text";

async function runStepBTests() {
  console.log("\n========================================================");
  console.log("   TESTES DA ETAPA (B): BANCO, SCHEDULER, RETRY & RECOVERY");
  console.log("========================================================\n");

  const mockProvider = new MockTwitterProvider();
  const scheduler = new SchedulerWorker(mockProvider);
  scheduler.setMinIntervalSeconds(0); // Para execução imediata nos testes
  const postsService = new PostsService(mockProvider);

  // 1. Teste de contagem de caracteres (URLs como 23 chars, emojis compostos)
  console.log("1. Testando validador de 280 caracteres (twitter-text)...");
  const testUrl = "Confira a novidade em https://meusite.com.br/artigo-longo-com-parametros-extensos?ref=twitter 🚀🔥";
  const valResult = validateTweetText(testUrl);
  console.log(`   Texto: "${testUrl}"`);
  console.log(`   Comprimento ponderado (URLs = 23 chars): ${valResult.length} / 280 (Válido: ${valResult.valid})`);
  if (!valResult.valid) throw new Error("Validação de texto falhou!");

  // 2. Criar post agendado no banco
  console.log("\n2. Testando criação de post agendado no SQLite...");
  const scheduledTime = new Date(Date.now() - 1000); // 1 segundo atrás para ser imediatamente executado
  const post = await prisma.scheduledPost.create({
    data: {
      text: "Primeiro post automatizado via Scheduler! #TwitterDash #IA",
      scheduledAt: scheduledTime,
      mediaPaths: "[]",
      status: "agendado"
    }
  });
  console.log(`   Post criado no banco com ID: ${post.id}, Status: ${post.status}`);

  // 3. Teste de Lock e Publicação do Scheduler
  console.log("\n3. Processando fila com o Scheduler (Mock Provider)...");
  await scheduler.processQueue();

  const publishedPost = await prisma.scheduledPost.findUnique({ where: { id: post.id } });
  console.log(`   Status após execução do Scheduler: ${publishedPost?.status}`);
  console.log(`   Tweet ID gerado: ${publishedPost?.tweetId}`);
  if (publishedPost?.status !== "publicado") {
    throw new Error(`Esperado status 'publicado', obteve '${publishedPost?.status}'`);
  }

  // 4. Teste de Falha e Backoff Exponencial (Retentativa)
  console.log("\n4. Testando Retry e Backoff Exponencial em caso de falha...");
  mockProvider.shouldFail = true;
  mockProvider.failError = "Rate limit temporário do Twitter (429)";

  const failPost = await prisma.scheduledPost.create({
    data: {
      text: "Post que deve falhar e entrar em retentativa",
      scheduledAt: new Date(Date.now() - 1000),
      mediaPaths: "[]",
      status: "agendado"
    }
  });

  // 1ª tentativa
  await scheduler.processQueue();
  let retryPost = await prisma.scheduledPost.findUnique({ where: { id: failPost.id } });
  console.log(`   Tentativa 1 -> Status: ${retryPost?.status}, Tentativas: ${retryPost?.attempts}, Erro: ${retryPost?.lastError}`);
  if (retryPost?.attempts !== 1 || retryPost?.status !== "agendado") {
    throw new Error("Esperado retry agendado na tentativa 1!");
  }

  // Simula avanço de tempo e 2ª tentativa
  await prisma.scheduledPost.update({ where: { id: failPost.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
  await scheduler.processQueue();
  retryPost = await prisma.scheduledPost.findUnique({ where: { id: failPost.id } });
  console.log(`   Tentativa 2 -> Status: ${retryPost?.status}, Tentativas: ${retryPost?.attempts}`);
  if (retryPost?.attempts !== 2) throw new Error("Esperado attempts = 2!");

  // Simula avanço de tempo e 3ª tentativa (deve virar 'falhou')
  await prisma.scheduledPost.update({ where: { id: failPost.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
  await scheduler.processQueue();
  retryPost = await prisma.scheduledPost.findUnique({ where: { id: failPost.id } });
  console.log(`   Tentativa 3 -> Status: ${retryPost?.status}, Tentativas: ${retryPost?.attempts}, Erro final: ${retryPost?.lastError}`);
  if (retryPost?.status !== "falhou" || retryPost?.attempts !== 3) {
    throw new Error("Esperado status 'falhou' após 3 tentativas!");
  }

  // 5. Teste de Recuperação Pós-Crash
  console.log("\n5. Testando Recuperação Pós-Crash (posts travados em 'publicando')...");
  const crashPost = await prisma.scheduledPost.create({
    data: {
      text: "Post que estava no meio da publicação quando o servidor caiu",
      scheduledAt: new Date(),
      status: "publicando",
      attempts: 1
    }
  });

  const recoveredCount = await scheduler.recoverStuckPosts();
  const recoveredPost = await prisma.scheduledPost.findUnique({ where: { id: crashPost.id } });
  console.log(`   Total recuperado: ${recoveredCount}`);
  console.log(`   Post travado agora está com Status: ${recoveredPost?.status}, Tentativas: ${recoveredPost?.attempts}`);
  if (recoveredPost?.status !== "agendado") {
    throw new Error("Post travado deveria ter retornado para 'agendado'!");
  }

  // Limpeza dos posts de teste
  await prisma.scheduledPost.deleteMany({
    where: {
      id: { in: [post.id, failPost.id, crashPost.id] }
    }
  });

  console.log("\nTODOS OS TESTES DA ETAPA (B) PASSARAM COM SUCESSO!\n");
  process.exit(0);
}

runStepBTests().catch((err) => {
  console.error("FALHA NO TESTE DA ETAPA (B):", err);
  process.exit(1);
});
