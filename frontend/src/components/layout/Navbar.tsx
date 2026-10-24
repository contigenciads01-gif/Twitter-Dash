import React from "react";
import { Sun, Moon, Twitter, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { TwitterAccount, McpStatusResponse } from "../../types";

interface NavbarProps {
  activeAccount: TwitterAccount | null;
  mcpStatus: McpStatusResponse | null;
  onRefreshMcp: () => void;
  onOpenAddAccount: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeAccount,
  mcpStatus,
  onRefreshMcp,
  onOpenAddAccount
}) => {
  const { theme, toggleTheme } = useTheme();

  const isConnected = mcpStatus?.connected && mcpStatus?.connectionTest?.ok;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white border-b border-slate-200 dark:bg-[#121824] dark:border-slate-800 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-twitter-blue/10 text-twitter-blue">
          <Twitter className="w-5 h-5 fill-current" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Twitter/X Dashboard
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              MCP Stdio
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fuso horário: America/Sao_Paulo (UTC)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Status da Conexão MCP */}
        <div
          onClick={onRefreshMcp}
          title={mcpStatus?.connectionTest?.message || "Status MCP"}
          className={`cursor-pointer hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isConnected
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40"
          }`}
        >
          {isConnected ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
          <span>{isConnected ? "MCP Online" : "MCP Conectando..."}</span>
          <RefreshCw className="w-3 h-3 opacity-60 hover:opacity-100 ml-1" />
        </div>

        {/* Conta Ativa ou Botão Adicionar Conta */}
        {activeAccount ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {activeAccount.avatarUrl ? (
              <img
                src={activeAccount.avatarUrl}
                alt={activeAccount.username}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-twitter-blue text-white flex items-center justify-center text-xs font-bold">
                {activeAccount.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block leading-tight">
                @{activeAccount.username}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenAddAccount}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-twitter-blue hover:bg-twitter-hover text-white transition-colors"
          >
            + Conectar Conta
          </button>
        )}

        {/* Alternador de Tema Claro/Escuro */}
        <button
          onClick={toggleTheme}
          aria-label="Alternar tema claro ou escuro"
          className="p-2 text-slate-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
        >
          {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
