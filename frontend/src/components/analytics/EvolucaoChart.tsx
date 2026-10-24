import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart as LineIcon, X } from "lucide-react";
import { api } from "../../services/api";

interface EvolucaoChartProps {
  tweetId: string | null;
  onClose: () => void;
}

export const EvolucaoChart: React.FC<EvolucaoChartProps> = ({ tweetId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tweetId) return;

    let isMounted = true;
    setLoading(true);

    api
      .get(`/analytics/post/${tweetId}`)
      .then((res) => {
        if (isMounted) setData(res.data);
      })
      .catch((err) => console.error("Erro ao carregar evolução do post:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tweetId]);

  if (!tweetId) return null;

  const chartData = (data?.timeline || []).map((item: any) => ({
    time: format(new Date(item.capturedAt), "dd/MM HH:mm", { locale: ptBR }),
    score: item.score,
    curtidas: item.likes,
    retweets: item.retweets,
    respostas: item.replies
  }));

  return (
    <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <LineIcon className="w-4 h-4 text-twitter-blue" />
            Evolução Temporal de Métricas
          </h4>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            "{data?.postText || `Tweet ID: ${tweetId}`}"
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          Carregando histórico de snapshots...
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          Apenas 1 snapshot registrado até o momento. Mais dados serão plotados conforme o cron das métricas roda.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1E2732",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "12px",
                  color: "#fff"
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Line type="monotone" dataKey="score" stroke="#F59E0B" strokeWidth={2.5} name="Score" />
              <Line type="monotone" dataKey="curtidas" stroke="#EF4444" strokeWidth={1.8} name="Curtidas" />
              <Line type="monotone" dataKey="retweets" stroke="#10B981" strokeWidth={1.8} name="Retweets" />
              <Line type="monotone" dataKey="respostas" stroke="#3B82F6" strokeWidth={1.8} name="Respostas" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
