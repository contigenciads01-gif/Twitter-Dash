import { prisma } from "../db/client";
import { calculateEngagementScore, getScoringWeights, updateScoringWeights } from "../config/scoring";
import { AnalyticsService } from "../modules/analytics/analytics.service";

async function runStepCTests() {
  console.log("\n========================================================");
  console.log("   TESTES DA ETAPA (C): ANALYTICS, SCORE & RANKING");
  console.log("========================================================\n");

  const analyticsService = new AnalyticsService();

  // 1. Teste de cálculo unitário do Score de Engajamento
  console.log("1. Testando fórmula do Score de Engajamento...");
  const metricsSample = {
    likes: 10,     // 10 * 1 = 10
    retweets: 5,   // 5 * 3 = 15
    replies: 3,    // 3 * 2 = 6
    quotes: 2,     // 2 * 3 = 6
    views: 1000    // 1000 * 0.01 = 10
  };
  const expectedScore = 10 + 15 + 6 + 6 + 10; // 47.0
  const computedScore = calculateEngagementScore(metricsSample);
  console.log(`   Métricas:`, metricsSample);
  console.log(`   Score Calculado: ${computedScore} (Esperado: ${expectedScore})`);
  if (computedScore !== expectedScore) {
    throw new Error(`Score incorreto! Esperado ${expectedScore}, obteve ${computedScore}`);
  }

  // 2. Teste de atualização e persistência de pesos customizados
  console.log("\n2. Testando customização de pesos do score...");
  await updateScoringWeights({ likes: 2, retweets: 5 });
  const updatedWeights = await getScoringWeights();
  console.log(`   Pesos atualizados:`, updatedWeights);
  if (updatedWeights.likes !== 2 || updatedWeights.retweets !== 5) {
    throw new Error("Atualização de pesos falhou!");
  }

  // Restaura pesos padrões
  await updateScoringWeights({ likes: 1, retweets: 3 });

  // 3. Preparando dados de teste para Ranking e Overview
  console.log("\n3. Criando tweets de teste com métricas históricas...");
  const now = new Date();

  // Post A (Top engajamento)
  const postA = await prisma.scheduledPost.create({
    data: {
      text: "Post A: Análise aprofundada sobre Model Context Protocol e agentes IA 🚀",
      scheduledAt: now,
      status: "publicado",
      publishedAt: new Date(now.getTime() - 2 * 3600 * 1000), // 2 horas atrás
      tweetId: "tweet_test_a"
    }
  });

  await prisma.tweetMetricsSnapshot.create({
    data: {
      tweetId: "tweet_test_a",
      capturedAt: new Date(now.getTime() - 1 * 3600 * 1000),
      likes: 100,
      retweets: 30,
      replies: 20,
      quotes: 10,
      views: 5000
    }
  });

  // Post B (Médio engajamento)
  const postB = await prisma.scheduledPost.create({
    data: {
      text: "Post B: Dica rápida de TypeScript e Tailwind CSS 💻",
      scheduledAt: now,
      status: "publicado",
      publishedAt: new Date(now.getTime() - 4 * 3600 * 1000), // 4 horas atrás
      tweetId: "tweet_test_b"
    }
  });

  await prisma.tweetMetricsSnapshot.create({
    data: {
      tweetId: "tweet_test_b",
      capturedAt: new Date(now.getTime() - 1 * 3600 * 1000),
      likes: 20,
      retweets: 5,
      replies: 2,
      quotes: 1,
      views: 800
    }
  });

  // 4. Teste de Ranking
  console.log("\n4. Testando GET Ranking ordenado por score...");
  const rankingResult = await analyticsService.getRanking({ period: "7d", sort: "score" });
  console.log(`   Total no ranking: ${rankingResult.totalCount}`);
  console.log(`   Top 1: "${rankingResult.ranking[0].text}" -> Score: ${rankingResult.ranking[0].score}`);
  console.log(`   Top 2: "${rankingResult.ranking[1]?.text}" -> Score: ${rankingResult.ranking[1]?.score}`);

  if (rankingResult.ranking[0].tweetId !== "tweet_test_a") {
    throw new Error("Esperava tweet_test_a como 1º colocado no ranking!");
  }

  // 5. Teste de Overview (Totais e melhor horário)
  console.log("\n5. Testando Overview de métricas...");
  const overviewResult = await analyticsService.getOverview("7d");
  console.log(`   Totais do período:`, overviewResult.totals);
  console.log(`   Melhor horário para postar: ${overviewResult.bestTimeToPost.dayName} às ${overviewResult.bestTimeToPost.formattedTime}`);

  if (overviewResult.totals.posts < 2) {
    throw new Error("Overview deveria contabilizar pelo menos os 2 posts criados.");
  }

  // 6. Teste de Evolução de Métricas do Post
  console.log("\n6. Testando Evolução temporal de snapshots do post A...");
  // Adiciona segundo snapshot para verificar linha temporal
  await prisma.tweetMetricsSnapshot.create({
    data: {
      tweetId: "tweet_test_a",
      capturedAt: now,
      likes: 120,
      retweets: 35,
      replies: 25,
      quotes: 12,
      views: 6200
    }
  });

  const evolution = await analyticsService.getPostEvolution("tweet_test_a");
  console.log(`   Total de snapshots encontrados na evolução: ${evolution.snapshotsCount}`);
  if (evolution.snapshotsCount !== 2) {
    throw new Error("Esperado 2 snapshots na evolução do post A!");
  }

  // Limpeza
  await prisma.tweetMetricsSnapshot.deleteMany({
    where: { tweetId: { in: ["tweet_test_a", "tweet_test_b"] } }
  });
  await prisma.scheduledPost.deleteMany({
    where: { id: { in: [postA.id, postB.id] } }
  });

  console.log("\nTODOS OS TESTES DA ETAPA (C) PASSARAM COM SUCESSO!\n");
  process.exit(0);
}

runStepCTests().catch((err) => {
  console.error("FALHA NO TESTE DA ETAPA (C):", err);
  process.exit(1);
});
