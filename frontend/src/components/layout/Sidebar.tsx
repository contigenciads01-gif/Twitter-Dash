import React from "react";
import { LayoutDashboard, CalendarClock, Trophy, Settings } from "lucide-react";

export type NavTab = "overview" | "schedule" | "results" | "settings";

interface SidebarProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingPostsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onChangeTab,
  pendingPostsCount = 0
}) => {
  const navItems = [
    {
      id: "overview" as NavTab,
      label: "Visão Geral",
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: "schedule" as NavTab,
      label: "Agendar",
      icon: CalendarClock,
      badge: pendingPostsCount > 0 ? pendingPostsCount : null
    },
    {
      id: "results" as NavTab,
      label: "Resultados",
      icon: Trophy,
      badge: null
    },
    {
      id: "settings" as NavTab,
      label: "Configurações",
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#121824] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between py-6 px-4 transition-colors">
      <div className="space-y-1">
        <div className="px-3 pb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navegação
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? "bg-twitter-blue text-white shadow-sm shadow-twitter-blue/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <div className="font-semibold text-slate-700 dark:text-slate-300">Twitter MCP Server</div>
        <p className="text-[11px] leading-relaxed">
          Comunicação direta via stdio com cliente oficial ElizaOS.
        </p>
      </div>
    </aside>
  );
};
