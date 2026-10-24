import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  Sliders,
  Terminal,
  Clock,
  UserCheck
} from "lucide-react";
import { ScoringWeights, McpStatusResponse, TwitterAccount } from "../types";
import { api } from "../services/api";

interface SettingsPageProps {
  onOpenAddAccount: () => void;
  onAccountChanged: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onOpenAddAccount,
  onAccountChanged
}) => {
  const [weights, setWeights] = useState<ScoringWeights>({
    likes: 1,
    retweets: 3,
    replies: 2,
    quotes: 3,
    views: 0.01
  });
  const [accounts, setAccounts] = useState<TwitterAccount[]>([]);
  const [mcpStatus, setMcpStatus] = useState<McpStatusResponse | null>(null);
  const [savingWeights, setSavingWeights] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [reconnectingMcp, setReconnectingMcp] = useState(false);

  const fetchSettings = async () => {
    try {
      const [weightsRes, accountsRes, mcpRes] = await Promise.all([
        api.get("/settings/scoring"),
        api.get("/accounts"),
        api.get("/settings/mcp-status")
      ]);
      setWeights(weightsRes.data.weights);
      setAccounts(accountsRes.data);
      setMcpStatus(mcpRes.data);
    } catch (err) {
      console.error("Erro ao carregar configurações:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWeights(true);
    try {
      await api.put("/settings/scoring", weights);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingWeights(false);
    }
  };

  const handleActivateAccount = async (id: string) => {
    try {
      await api.patch(`/accounts/${id}/activate`);
      fetchSettings();
      onAccountChanged();
    } catch (err: any) {
      alert(`Erro ao ativar conta: ${err.message}`);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Remover esta conta do dashboard?")) return;
    try {
      await api.delete(`/accounts/${id}`);
      fetchSettings();
      onAccountChanged();
    } catch (err: any) {
      alert(`Erro ao remover conta: ${err.message}`);
    }
  };

  const handleReconnectMcp = async () => {
    setReconnectingMcp(true);
    try {
      await api.post("/settings/mcp-reconnect");
      await fetchSettings();
    } catch (err: any) {
      alert(`Erro ao reconectar: ${err.message}`);
    } finally {
      setReconnectingMcp(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Configurações do Sistema
        </h2>
        <p className="text-xs text-slate-500">
          Pesos da fórmula de engajamento, status do servidor MCP e contas conectadas
        </p>
      </div>

      {/* Seção 1: Contas do Twitter/X Conectadas */}
      <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-twitter-blue" />
              Contas do Twitter/X
            </h3>
            <p className="text-xs text-slate-500">
              Contas autorizadas no processo filho MCP
            </p>
          </div>
          <button
            onClick={onOpenAddAccount}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-twitter-blue hover:bg-twitter-hover text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Conta
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Nenhuma conta configurada ainda. Clique em "Adicionar Conta" para autorizar o Twitter/X.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {accounts.map((acc) => (
              <div key={acc.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {acc.avatarUrl ? (
                    <img src={acc.avatarUrl} alt={acc.username} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-twitter-blue text-white flex items-center justify-center font-bold text-sm">
                      {acc.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {acc.displayName || `@${acc.username}`}
                      </span>
                      <span className="text-xs text-slate-400">@{acc.username}</span>
                      {acc.isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          Ativa
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Conexão: {acc.hasScrapingCredentials ? "Login MCP (Scraping)" : "API Oficial"} • Status: {acc.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!acc.isActive && (
                    <button
                      onClick={() => handleActivateAccount(acc.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Ativar
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                    title="Remover conta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção 2: Pesos do Score de Engajamento */}
      <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-twitter-blue" />
            Pesos do Score de Engajamento
          </h3>
          <p className="text-xs text-slate-500">
            Ajuste a pontuação de cada métrica para calibrar o ranking
          </p>
        </div>

        <form onSubmit={handleSaveWeights} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Curtidas
              </label>
              <input
                type="number"
                step="0.1"
                value={weights.likes}
                onChange={(e) => setWeights({ ...weights, likes: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Retweets
              </label>
              <input
                type="number"
                step="0.1"
                value={weights.retweets}
                onChange={(e) => setWeights({ ...weights, retweets: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Respostas
              </label>
              <input
                type="number"
                step="0.1"
                value={weights.replies}
                onChange={(e) => setWeights({ ...weights, replies: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quotes
              </label>
              <input
                type="number"
                step="0.1"
                value={weights.quotes}
                onChange={(e) => setWeights({ ...weights, quotes: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Views
              </label>
              <input
                type="number"
                step="0.001"
                value={weights.views}
                onChange={(e) => setWeights({ ...weights, views: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Fórmula: ({weights.likes}×Likes) + ({weights.retweets}×RTs) + ({weights.replies}×Replies) + ({weights.quotes}×Quotes) + ({weights.views}×Views)
            </span>
            <button
              type="submit"
              disabled={savingWeights}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-twitter-blue hover:bg-twitter-hover text-white disabled:opacity-50 transition-colors shadow-sm"
            >
              {savingWeights ? "Salvando..." : saveSuccess ? "Salvo com sucesso!" : "Salvar Pesos"}
            </button>
          </div>
        </form>
      </div>

      {/* Seção 3: Status do Servidor MCP e Tools */}
      <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-500" />
              Status do Servidor MCP (Stdio)
            </h3>
            <p className="text-xs text-slate-500">
              Processo filho persistente gerenciado via StdioClientTransport
            </p>
          </div>
          <button
            onClick={handleReconnectMcp}
            disabled={reconnectingMcp}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconnectingMcp ? "animate-spin" : ""}`} />
            Reconectar Processo
          </button>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Conexão:</span>
            {mcpStatus?.connected ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Ativa via stdio
              </span>
            ) : (
              <span className="text-amber-500 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Desconectado
              </span>
            )}
          </div>
          <div className="text-slate-500 dark:text-slate-400">
            Mensagem: {mcpStatus?.connectionTest?.message || "Servidor pronto para execução."}
          </div>
        </div>

        {/* Tools descobertas dinamicamente */}
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Ferramentas MCP Descobertas ({mcpStatus?.tools?.length || 0}):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(mcpStatus?.tools || []).map((tool) => (
              <span
                key={tool.name}
                title={tool.description}
                className="px-2.5 py-1 text-[11px] font-mono rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              >
                {tool.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
