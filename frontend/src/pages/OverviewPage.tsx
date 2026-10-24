import React, { useEffect, useState } from "react";
import { MessageSquare, Heart, Repeat, Eye, Award, Calendar, ArrowRight } from "lucide-react";
import { MetricCard } from "../components/common/MetricCard";
import { MetricsOverviewSkeleton } from "../components/common/LoadingSkeleton";
import { BestTimesHeatmap } from "../components/analytics/BestTimesHeatmap";
import { AnalyticsOverview, ScheduledPost } from "../types";
import { api } from "../services/api";

interface OverviewPageProps {
  onNavigateSchedule: () => void;
  onNavigateResults: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigateSchedule,
  onNavigateResults
}) => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [nextPosts, setNextPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.get("/analytics/overview?period=7d"),
      api.get("/posts?status=agendado&limit=3")
    ])
      .then(([ovRes, postsRes]) => {
        if (isMounted) {
          setOverview(ovRes.data);
          setNextPosts(postsRes.data);
        }
      })
      .catch((err) => console.error("Erro ao carregar dados da visão geral:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Visão Geral da Conta
          </h2>
          <p className="text-xs text-slate-500">
            Performance nos últimos 7 dias e próximos posts da fila
          </p>
        </div>

        <button
          onClick={onNavigateSchedule}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-twitter-blue hover:bg-twitter-hover text-white transition-colors shadow-sm"
        >
          <Calendar className="w-3.5 h-3.5" />
          Agendar Novo Post
        </button>
      </div>

      {/* Cards de Métricas Principais */}
      {loading ? (
        <MetricsOverviewSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total de Posts"
            value={overview?.totals.posts ?? 0}
            variation={overview?.variations.postsPercent}
            icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
            subtitle="Publicações ativas no período"
          />
          <MetricCard
            title="Curtidas"
            value={(overview?.totals.likes ?? 0).toLocaleString()}
            variation={overview?.variations.likesPercent}
            icon={<Heart className="w-5 h-5 text-rose-500" />}
            subtitle="Total de curtidas recebidas"
          />
          <MetricCard
            title="Retweets"
            value={(overview?.totals.retweets ?? 0).toLocaleString()}
            variation={overview?.variations.retweetsPercent}
            icon={<Repeat className="w-5 h-5 text-emerald-500" />}
            subtitle="Compartilhamentos de tweets"
          />
          <MetricCard
            title="Engajamento Médio"
            value={overview?.totals.avgEngagement ?? 0}
            variation={overview?.variations.avgEngagementPercent}
            icon={<Award className="w-5 h-5 text-amber-500" />}
            subtitle="Pontos de score por publicação"
          />
        </div>
      )}

      {/* Grid: Próximos Posts & Gráfico de Horários */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BestTimesHeatmap overview={overview} />
        </div>

        {/* Fila Imediata */}
        <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Próximos Agendamentos
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {nextPosts.length} na fila
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {nextPosts.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Nenhum post aguardando publicação.
                </p>
              ) : (
                nextPosts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-xs space-y-1.5"
                  >
                    <span className="text-[10px] font-semibold text-slate-400 block">
                      {new Date(p.scheduledAt).toLocaleString("pt-BR")}
                    </span>
                    <p className="line-clamp-2 text-slate-800 dark:text-slate-200 font-medium">
                      {p.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={onNavigateResults}
            className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Ver Ranking Completo de Posts
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
