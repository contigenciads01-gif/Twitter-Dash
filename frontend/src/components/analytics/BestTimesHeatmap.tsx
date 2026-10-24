import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { Clock, Calendar } from "lucide-react";
import { AnalyticsOverview } from "../../types";

interface BestTimesHeatmapProps {
  overview: AnalyticsOverview | null;
}

export const BestTimesHeatmap: React.FC<BestTimesHeatmapProps> = ({ overview }) => {
  if (!overview) return null;

  // Prepara dados de dias da semana para o gráfico de barras
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dayAverages = dayNames.map((name, dayIndex) => {
    const slots = overview.heatmap.filter((h) => h.day === dayIndex);
    const totalScore = slots.reduce((acc, curr) => acc + curr.avgScore * curr.postsCount, 0);
    const totalCount = slots.reduce((acc, curr) => acc + curr.postsCount, 0);
    const avgScore = totalCount > 0 ? Number((totalScore / totalCount).toFixed(2)) : 0;

    return {
      name,
      score: avgScore,
      posts: totalCount
    };
  });

  return (
    <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-twitter-blue" />
            Melhores Dias e Horários para Postar
          </h4>
          <p className="text-xs text-slate-500">
            Baseado na média histórica de engajamento das suas publicações
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800/40">
          <Calendar className="w-3.5 h-3.5" />
          Pico: {overview.bestTimeToPost.dayName} às {overview.bestTimeToPost.formattedTime} (Score Médio: {overview.bestTimeToPost.avgScore})
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dayAverages} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: any) => [`${value} pts`, "Engajamento Médio"]}
              contentStyle={{
                backgroundColor: "#1E2732",
                borderRadius: "10px",
                border: "none",
                fontSize: "12px",
                color: "#fff"
              }}
            />
            <Bar dataKey="score" fill="#1D9BF0" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
