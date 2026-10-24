import React, { useState, useEffect } from "react";
import { Navbar } from "./components/layout/Navbar";
import { Sidebar, NavTab } from "./components/layout/Sidebar";
import { OverviewPage } from "./pages/OverviewPage";
import { SchedulePage } from "./pages/SchedulePage";
import { ResultsPage } from "./pages/ResultsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AddAccountModal } from "./components/accounts/AddAccountModal";
import { TwitterAccount, McpStatusResponse } from "./types";
import { api } from "./services/api";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>("overview");
  const [activeAccount, setActiveAccount] = useState<TwitterAccount | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpStatusResponse | null>(null);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [pendingPostsCount, setPendingPostsCount] = useState(0);

  const fetchGlobalState = async () => {
    try {
      const [mcpRes, accountsRes, postsRes] = await Promise.all([
        api.get("/settings/mcp-status").catch(() => ({ data: null })),
        api.get("/accounts").catch(() => ({ data: [] })),
        api.get("/posts?status=agendado").catch(() => ({ data: [] }))
      ]);

      if (mcpRes.data) {
        setMcpStatus(mcpRes.data);
      }

      if (Array.isArray(accountsRes.data)) {
        const active = accountsRes.data.find((a: TwitterAccount) => a.isActive);
        setActiveAccount(active || null);
      }

      if (Array.isArray(postsRes.data)) {
        setPendingPostsCount(postsRes.data.length);
      }
    } catch (err) {
      console.error("Erro ao sincronizar estado da aplicação:", err);
    }
  };

  useEffect(() => {
    fetchGlobalState();
    const interval = setInterval(fetchGlobalState, 30000); // Sincroniza a cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar
        activeAccount={activeAccount}
        mcpStatus={mcpStatus}
        onRefreshMcp={fetchGlobalState}
        onOpenAddAccount={() => setIsAddAccountOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onChangeTab={setCurrentTab}
          pendingPostsCount={pendingPostsCount}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {currentTab === "overview" && (
              <OverviewPage
                onNavigateSchedule={() => setCurrentTab("schedule")}
                onNavigateResults={() => setCurrentTab("results")}
              />
            )}
            {currentTab === "schedule" && <SchedulePage />}
            {currentTab === "results" && <ResultsPage />}
            {currentTab === "settings" && (
              <SettingsPage
                onOpenAddAccount={() => setIsAddAccountOpen(true)}
                onAccountChanged={fetchGlobalState}
              />
            )}
          </div>
        </main>
      </div>

      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onAccountAdded={fetchGlobalState}
      />
    </div>
  );
};

export default App;
