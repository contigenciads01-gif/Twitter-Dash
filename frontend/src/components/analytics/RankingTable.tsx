import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink,
  Heart,
  Repeat,
  MessageCircle,
  Eye,
  ArrowUpDown,
  Trophy,
  LineChart
} from "lucide-react";
import { TweetRankingItem } from "../../types";

interface RankingTableProps {
  ranking: TweetRankingItem[];
  period: "7d" | "30d" | "all";
  onChangePeriod: (p: "7d" | "30d" | "all") => void;
  sortBy: string;
  onChangeSort: (sort: string) => void;
  selectedTweetId: string | null;
  onSelectTweet: (tweetId: string) => void;
  loading: boolean;
}

export const RankingTable: React.FC<RankingTableProps> = ({
  ranking,
  period,
  onChangePeriod,
  sortBy,
  onChangeSort,
  selectedTweetId,
  onSelectTweet,
  loading
}) => {
  // Verifica se alguma métrica de views existe (se todas forem null, esconde a coluna sem quebrar)
  const hasViewsData = ranking.some((item) => item.metrics.views !== null && item.metrics.views !== undefined);

  const getMedal = (pos: number) => {
    if (pos === 1) return <span className="text-xl">🥇</span>;
    if (pos === 2) return <span className="text-xl">🥈</span>;
    if (pos === 3) return <span className="text-xl">🥉</span>;
    return <span className="text-xs font-bold text-slate-400">#{pos}</span>;
  };

  return (
    <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Ranking de Publicações & Engajamento
          </h3>
          <p className="text-xs text-slate-500">
            Clique em qualquer publicação para ver a evolução temporal das métricas
          </p>
        </div>

        {/* Seletor de período */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-medium">
          {(["7d", "30d", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onChangePeriod(p)}
              className={`px-3 py-1 rounded-lg uppercase transition-colors ${
                period === p
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {p === "all" ? "Todos" : p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
          Calculando ranking de engajamento...
        </div>
      ) : ranking.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500">
          Nenhuma publicação com métricas encontrada no período selecionado.
        </div>
      ) : (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3 w-16 text-center">Posição</th>
                <th className="py-3 px-3">Publicação</th>
                <th className="py-3 px-3 w-28">Data</th>
                <th
                  onClick={() => onChangeSort("likes")}
                  className="py-3 px-3 text-right cursor-pointer hover:text-twitter-blue transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500" /> Curtidas
                    {sortBy === "likes" && <ArrowUpDown className="w-3 h-3 text-twitter-blue" />}
                  </span>
                </th>
                <th
                  onClick={() => onChangeSort("retweets")}
                  className="py-3 px-3 text-right cursor-pointer hover:text-twitter-blue transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5 text-emerald-500" /> RTs
                    {sortBy === "retweets" && <ArrowUpDown className="w-3 h-3 text-twitter-blue" />}
                  </span>
                </th>
                <th
                  onClick={() => onChangeSort("replies")}
                  className="py-3 px-3 text-right cursor-pointer hover:text-twitter-blue transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5 text-sky-500" /> Respostas
                    {sortBy === "replies" && <ArrowUpDown className="w-3 h-3 text-twitter-blue" />}
                  </span>
                </th>
                {hasViewsData && (
                  <th
                    onClick={() => onChangeSort("views")}
                    className="py-3 px-3 text-right cursor-pointer hover:text-twitter-blue transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-amber-500" /> Views
                      {sortBy === "views" && <ArrowUpDown className="w-3 h-3 text-twitter-blue" />}
                    </span>
                  </th>
                )}
                <th
                  onClick={() => onChangeSort("score")}
                  className="py-3 px-3 text-right cursor-pointer hover:text-twitter-blue transition-colors font-bold"
                >
                  <span className="inline-flex items-center gap-1">
                    Score
                    {sortBy === "score" && <ArrowUpDown className="w-3 h-3 text-twitter-blue" />}
                  </span>
                </th>
                <th className="py-3 px-3 text-center w-16">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {ranking.map((item) => {
                const isSelected = selectedTweetId === item.tweetId;
                const formattedDate = format(new Date(item.publishedAt), "dd/MM HH:mm", {
                  locale: ptBR
                });

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectTweet(item.tweetId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50/80 dark:bg-blue-950/30 font-medium"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="py-3.5 px-3 text-center">{getMedal(item.position)}</td>
                    <td className="py-3.5 px-3 max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-2">
                        {isSelected && <LineChart className="w-4 h-4 text-twitter-blue flex-shrink-0" />}
                        <p className="line-clamp-2 text-slate-800 dark:text-slate-200">
                          {item.text}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                      {formattedDate}
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {item.metrics.likes.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {item.metrics.retweets.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {item.metrics.replies.toLocaleString()}
                    </td>
                    {hasViewsData && (
                      <td className="py-3.5 px-3 text-right text-slate-500">
                        {item.metrics.views !== null && item.metrics.views !== undefined
                          ? item.metrics.views.toLocaleString()
                          : "-"}
                      </td>
                    )}
                    <td className="py-3.5 px-3 text-right">
                      <span className="inline-block px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                        {item.score}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={item.tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-twitter-blue transition-colors inline-block"
                        title="Abrir no X"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
