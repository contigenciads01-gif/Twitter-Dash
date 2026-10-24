import { prisma } from "../db/client";
import { MockTwitterProvider } from "../providers/mock.provider";
import { SchedulerWorker } from "../workers/scheduler.worker";
import { PostsService } from "../modules/posts/posts.service";
import { AnalyticsService } from "../modules/analytics/analytics.service";
import { validateTweetText } from "../utils/twitter-text";
import { calculateEngagementScore, updateScoringWeights, getScoringWeights } from "../config/scoring";

async function runTestSuite() {
  console.log("\n================================================================================");
  console.log("   SUÍTE DE TESTES UNITÁRIOS E INTEGRAÇÃO - TWITTER/X DASHBOARD");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (!condition) {
      console.error(`  ❌ FALHA: ${testName}`);
      throw new Error(`Falha no teste: ${testName}`);
    }
    console.log(`  ✅ SUCESSO: ${testName}`);
    passedTests++;
  }

  // 1. Validação de Caracteres (twitter-text)
  console.log("\n--- [1/5] Validação de 280 Caracteres e Emojis ---");
  const shortText = "Texto simples de teste.";
  assert(validateTweetText(shortText).valid === true, "Texto simples deve ser válido");

  const urlText = "Link: https://deepmind.google/technologies/gemini/ com emojis 🚀🤖✨";
  const urlParsed = validateTweetText(urlText);
  assert(urlParsed.valid === true, "Texto com URL e emojis multi-codepoint deve ser válido");
  // URL ocupa 23 chars no padrão Twitter
  assert(urlParsed.length < 70, "URL deve ser ponderada com 23 caracteres");

  const longText = "a".repeat(281);
  assert(validateTweetText(longText).valid === false, "Texto com 281 caracteres deve ser rejeitado");

  // 2. Cálculo do Engagement Score
  console.log("\n--- [2/5] Fórmula do Score de Engajamento ---");
  const metrics = { likes: 10, retweets: 4, replies: 3, quotes: 2, views: 1000 };
  // 10*1 + 4*3 + 3*2 + 2*3 + 1000*0.01 = 10 + 12 + 6 + 6 + 10 = 44.0
  const score = calculateEngagementScore(metrics);
  assert(score === 44.0, `Score calculado (${score}) deve ser exatamente 44.0`);

  const metricsWithoutViews = { likes: 5, retweets: 2, replies: 1, quotes: 0, views: null };
  // 5*1 + 2*3 + 1*2 = 5 + 6 + 2 = 13.0
  const scoreNoViews = calculateEngagementScore(metricsWithoutViews);
  assert(scoreNoViews === 13.0, "Score com views nulas não deve quebrar e somar 13.0");

  // 3. Scheduler: Lock e Publicação Atômica
  console.log("\n--- [3/5] Scheduler: Lock Atômico e Publicação ---");
  const mockProvider = new MockTwitterProvider();
  const scheduler = new SchedulerWorker(mockProvider);
  scheduler.setMinIntervalSeconds(0);
  const postsService = new PostsService(mockProvider);

  const postAgendado = await prisma.scheduledPost.create({
    data: {
      text: "Post para teste do Scheduler",
      scheduledAt: new Date(Date.now() - 2000),
      status: "agendado"
    }
  });

  await scheduler.processQueue();
  const postPublicado = await prisma.scheduledPost.findUnique({ where: { id: postAgendado.id } });
  assert(postPublicado?.status === "publicado", "Post com data passada deve ser publicado pelo scheduler");
  assert(Boolean(postPublicado?.tweetId), "Post publicado deve possuir tweetId gerado");

  // 4. Scheduler: 3 Tentativas com Backoff Exponencial e Falha Final
  console.log("\n--- [4/5] Scheduler: Retentativas e Backoff Exponencial ---");
  mockProvider.shouldFail = true;
  mockProvider.failError = "Erro 503 Twitter indisponível";

  const postFalha = await prisma.scheduledPost.create({
    data: {
      text: "Post que falhará no envio",
      scheduledAt: new Date(Date.now() - 2000),
      status: "agendado"
    }
  });

  // Tentativa 1
  await scheduler.processQueue();
  let failCheck = await prisma.scheduledPost.findUnique({ where: { id: postFalha.id } });
  assert(failCheck?.attempts === 1 && failCheck?.status === "agendado", "Tentativa 1 deve reagendar o post");

  // Tentativa 2
  await prisma.scheduledPost.update({ where: { id: postFalha.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
  await scheduler.processQueue();
  failCheck = await prisma.scheduledPost.findUnique({ where: { id: postFalha.id } });
  assert(failCheck?.attempts === 2 && failCheck?.status === "agendado", "Tentativa 2 deve reagendar com backoff");

  // Tentativa 3 (Final)
  await prisma.scheduledPost.update({ where: { id: postFalha.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
  await scheduler.processQueue();
  failCheck = await prisma.scheduledPost.findUnique({ where: { id: postFalha.id } });
  assert(failCheck?.attempts === 3 && failCheck?.status === "falhou", "Após 3 tentativas o status deve ser 'falhou'");
  assert(Boolean(failCheck?.lastError?.includes("Erro 503")), "Mensagem de erro deve ser gravada em lastError");

  // 5. Recuperação Pós-Crash
  console.log("\n--- [5/5] Resiliência: Recuperação de Posts Travados em Boot ---");
  const postTravado = await prisma.scheduledPost.create({
    data: {
      text: "Post preso em 'publicando' no crash",
      scheduledAt: new Date(),
      status: "publicando",
      attempts: 0
    }
  });

  const recovered = await scheduler.recoverStuckPosts();
  const recoveredCheck = await prisma.scheduledPost.findUnique({ where: { id: postTravado.id } });
  assert(recovered >= 1, "Scheduler deve detectar post travado no boot");
  assert(recoveredCheck?.status === "agendado", "Post travado deve ser recuperado para 'agendado'");

  // Limpeza
  await prisma.scheduledPost.deleteMany({
    where: { id: { in: [postAgendado.id, postFalha.id, postTravado.id] } }
  });

  console.log("\n================================================================================");
  console.log(`   RESULTADO: ${passedTests}/${totalTests} TESTES EXECUTADOS COM SUCESSO! 100% OK`);
  console.log("================================================================================\n");

  process.exit(0);
}

runTestSuite().catch((e) => {
  console.error("FALHA CRÍTICA NA SUÍTE DE TESTES:", e);
  process.exit(1);
});
