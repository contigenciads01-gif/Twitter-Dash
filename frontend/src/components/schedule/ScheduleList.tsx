import React, { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  RefreshCw,
  XCircle,
  ExternalLink,
  Send,
  AlertTriangle,
  Layers,
  Image as ImageIcon
} from "lucide-react";
import { ScheduledPost, PostStatus } from "../../types";
import { api } from "../../services/api";

interface ScheduleListProps {
  posts: ScheduledPost[];
  loading: boolean;
  onRefresh: () => void;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
  posts,
  loading,
  onRefresh
}) => {
  const [filter, setFilter] = useState<string>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredPosts = posts.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const handlePublishNow = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/posts/${id}/publish-now`);
      onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/posts/${id}/retry`);
      onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta publicação?")) return;
    setActionLoadingId(id);
    try {
      await api.delete(`/posts/${id}`);
      onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case "agendado":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
            Agendado
          </span>
        );
      case "publicando":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 animate-pulse">
            Publicando...
          </span>
        );
      case "publicado":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            Publicado
          </span>
        );
      case "falhou":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            Falhou
          </span>
        );
      case "cancelado":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Fila de Publicações
          </h3>
          <p className="text-xs text-slate-500">
            Gerencie seus posts futuros, histórico e retentativas
          </p>
        </div>

        {/* Filtros de status */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-medium">
          {["all", "agendado", "publicado", "falhou", "cancelado"].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1 rounded-lg capitalize transition-colors ${
                filter === st
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {st === "all" ? "Todos" : st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
          Carregando fila de publicações...
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <Calendar className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-sm font-medium">Nenhum post encontrado nesta categoria.</p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredPosts.map((post) => {
            const isLoading = actionLoadingId === post.id;
            const hasMedia = post.mediaPaths && post.mediaPaths.length > 0;
            const isThread = post.threadParts && post.threadParts.length > 0;

            const scheduledFormatted = format(
              new Date(post.scheduledAt),
              "dd/MM/yyyy 'às' HH:mm",
              { locale: ptBR }
            );

            return (
              <div key={post.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(post.status)}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {scheduledFormatted}
                    </span>
                    {isThread && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        <Layers className="w-3 h-3" /> Thread ({post.threadParts.length + 1} partes)
                      </span>
                    )}
                    {hasMedia && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <ImageIcon className="w-3 h-3" /> {post.mediaPaths.length} mídia(s)
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {post.text}
                  </p>

                  {/* Mensagem de Erro com Detalhes se falhou */}
                  {post.status === "falhou" && post.lastError && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-lg border border-rose-200/60 dark:border-rose-900/40">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Motivo do erro: {post.lastError} (Tentativas: {post.attempts}/3)</span>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  {post.status === "agendado" && (
                    <>
                      <button
                        disabled={isLoading}
                        onClick={() => handlePublishNow(post.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-twitter-blue hover:bg-twitter-hover text-white transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Publicar agora
                      </button>
                      <button
                        disabled={isLoading}
                        onClick={() => handleCancel(post.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                        title="Cancelar post"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {post.status === "falhou" && (
                    <button
                      disabled={isLoading}
                      onClick={() => handleRetry(post.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                      Tentar de novo
                    </button>
                  )}

                  {post.status === "publicado" && post.tweetId && (
                    <a
                      href={`https://twitter.com/i/web/status/${post.tweetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Ver no X
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
