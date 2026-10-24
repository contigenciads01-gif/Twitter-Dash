import React, { useState, useEffect } from "react";
import { List, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { ScheduleForm } from "../components/schedule/ScheduleForm";
import { ScheduleList } from "../components/schedule/ScheduleList";
import { ScheduleCalendar } from "../components/schedule/ScheduleCalendar";
import { ScheduledPost } from "../types";
import { api } from "../services/api";

export const SchedulePage: React.FC = () => {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/posts");
      setPosts(res.data);
    } catch (err) {
      console.error("Erro ao listar posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Agendamento & Fila de Publicações
          </h2>
          <p className="text-xs text-slate-500">
            Crie novos tweets ou threads e acompanhe o status em tempo real
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Alternador de Modo de Visualização */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Fila (Lista)
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === "calendar"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendário
            </button>
          </div>

          <button
            onClick={fetchPosts}
            title="Atualizar fila"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Formulário de Criação de Post */}
      <ScheduleForm onPostCreated={fetchPosts} />

      {/* Fila ou Calendário */}
      {viewMode === "list" ? (
        <ScheduleList posts={posts} loading={loading} onRefresh={fetchPosts} />
      ) : (
        <ScheduleCalendar posts={posts} />
      )}
    </div>
  );
};
