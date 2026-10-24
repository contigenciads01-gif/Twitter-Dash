import React, { useState, useEffect } from "react";
import { MessageSquare, Heart, Repeat, Award } from "lucide-react";
import { MetricCard } from "../components/common/MetricCard";
import { MetricsOverviewSkeleton } from "../components/common/LoadingSkeleton";
import { RankingTable } from "../components/analytics/RankingTable";
import { EvolucaoChart } from "../components/analytics/EvolucaoChart";
import { BestTimesHeatmap } from "../components/analytics/BestTimesHeatmap";
import { AnalyticsOverview, TweetRankingItem } from "../types";
import { api } from "../services/api";

export const ResultsPage: React.FC = () => {
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d");
  const [sortBy, setSortBy] = useState<string>("score");
  const [ranking, setRanking] = useState<TweetRankingItem[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [selectedTweetId, setSelectedTweetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rankRes, overRes] = await Promise.all([
        api.get(`/analytics/ranking?period=${period}&sort=${sortBy}&limit=20`),
        api.get(`/analytics/overview?period=${period}`)
      ]);
      setRanking(rankRes.data.ranking || []);
      setOverview(overRes.data);

      // Seleciona o primeiro post por padrão para o gráfico de linha se não houver seleção
      if (!selectedTweetId && rankRes.data.ranking?.length > 0) {
        setSelectedTweetId(rankRes.data.ranking[0].tweetId);
      }
    } catch (err) {
      console.error("Erro ao buscar dados de analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, sortBy]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Resultados & Ranking de Engajamento
        </h2>
        <p className="text-xs text-slate-500">
          Score: likes × 1 + retweets × 3 + replies × 2 + quotes × 3 + views × 0.01
        </p>
      </div>

      {/* Cards de Métricas do Período */}
      {loading && !overview ? (
        <MetricsOverviewSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Publicações"
            value={overview?.totals.posts ?? 0}
            variation={overview?.variations.postsPercent}
            icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
          />
          <MetricCard
            title="Curtidas"
            value={(overview?.totals.likes ?? 0).toLocaleString()}
            variation={overview?.variations.likesPercent}
            icon={<Heart className="w-5 h-5 text-rose-500" />}
          />
          <MetricCard
            title="Retweets"
            value={(overview?.totals.retweets ?? 0).toLocaleString()}
            variation={overview?.variations.retweetsPercent}
            icon={<Repeat className="w-5 h-5 text-emerald-500" />}
          />
          <MetricCard
            title="Score Médio"
            value={overview?.totals.avgEngagement ?? 0}
            variation={overview?.variations.avgEngagementPercent}
            icon={<Award className="w-5 h-5 text-amber-500" />}
          />
        </div>
      )}

      {/* Gráfico de Evolução ao Clicar em um Post */}
      {selectedTweetId && (
        <EvolucaoChart
          tweetId={selectedTweetId}
          onClose={() => setSelectedTweetId(null)}
        />
      )}

      {/* Tabela de Ranking */}
      <RankingTable
        ranking={ranking}
        period={period}
        onChangePeriod={setPeriod}
        sortBy={sortBy}
        onChangeSort={setSortBy}
        selectedTweetId={selectedTweetId}
        onSelectTweet={setSelectedTweetId}
        loading={loading}
      />

      {/* Melhores Horários e Dias */}
      <BestTimesHeatmap overview={overview} />
    </div>
  );
};
