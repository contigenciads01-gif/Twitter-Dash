import React, { useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Layers, ImageIcon } from "lucide-react";
import { ScheduledPost } from "../../types";

interface ScheduleCalendarProps {
  posts: ScheduledPost[];
}

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ posts }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 }); // Domingo
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const today = () => setCurrentDate(new Date());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "agendado":
        return "border-l-4 border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20";
      case "publicado":
        return "border-l-4 border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20";
      case "falhou":
        return "border-l-4 border-l-rose-500 bg-rose-50/60 dark:bg-rose-950/20";
      case "cancelado":
        return "border-l-4 border-l-slate-400 bg-slate-50 dark:bg-slate-800/30";
      default:
        return "border-l-4 border-l-purple-500 bg-purple-50/60";
    }
  };

  return (
    <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Visão em Calendário (Semanal)
          </h3>
          <p className="text-xs text-slate-500">
            Semana de {format(startDate, "dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={today}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Hoje
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={prevWeek}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextWeek}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day, idx) => {
          const isToday = isSameDay(day, new Date());
          const dayPosts = posts.filter((p) => isSameDay(new Date(p.scheduledAt), day));

          return (
            <div
              key={idx}
              className={`min-h-[220px] rounded-xl border p-2 flex flex-col ${
                isToday
                  ? "border-twitter-blue/40 bg-blue-50/20 dark:bg-blue-950/10"
                  : "border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30"
              }`}
            >
              <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                  {format(day, "EEE", { locale: ptBR })}
                </span>
                <span
                  className={`text-sm font-bold inline-block px-2 py-0.5 rounded-full ${
                    isToday ? "bg-twitter-blue text-white" : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {format(day, "dd")}
                </span>
              </div>

              <div className="mt-2 space-y-2 flex-1 overflow-y-auto max-h-[300px]">
                {dayPosts.map((post) => (
                  <div
                    key={post.id}
                    className={`p-2 rounded-lg text-xs shadow-xs space-y-1 ${getStatusColor(
                      post.status
                    )}`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                      <span>{format(new Date(post.scheduledAt), "HH:mm")}</span>
                      <span className="capitalize text-[9px] font-semibold px-1 rounded bg-black/5 dark:bg-white/10">
                        {post.status}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-slate-800 dark:text-slate-200 font-medium text-[11px]">
                      {post.text}
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                      {post.threadParts && post.threadParts.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Layers className="w-2.5 h-2.5" /> Fio
                        </span>
                      )}
                      {post.mediaPaths && post.mediaPaths.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <ImageIcon className="w-2.5 h-2.5" /> {post.mediaPaths.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
