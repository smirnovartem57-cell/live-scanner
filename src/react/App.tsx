import { useMemo, useState } from "react";
import { AnalyticsView } from "./components/AnalyticsView";
import { AppShell } from "./components/AppShell";
import { HistoryView } from "./components/HistoryView";
import { IdeasView } from "./components/IdeasView";
import { LiveScannerView } from "./components/LiveScannerView";
import { PatternLabView } from "./components/PatternLabView";
import { ProfileView } from "./components/ProfileView";
import { SettingsView } from "./components/SettingsView";
import { SignalListView } from "./components/SignalListView";
import { TeamProfileView } from "./components/TeamProfileView";
import { useFootballLabData } from "./hooks/useFootballLabData";
import { useJournalAutoIngest } from "./hooks/useJournalAutoIngest";
import { useJournalHistory } from "./hooks/useJournalHistory";
import { useReactSettings } from "./hooks/useReactSettings";
import { buildTeamProfileViewModel, type TeamProfileSelection } from "./domain/teamProfile";
import type { FootballDataSourceStatus } from "../services/footballDataProvider";
import type { ReactNavItem, ReactViewId } from "./types";

const navItems: ReactNavItem[] = [
  { id: "scanner", label: "Сканер", title: "Сканер матчей" },
  { id: "signals", label: "Сигналы", title: "Найденные сигналы" },
  { id: "patterns", label: "Паттерны", title: "Паттерны" },
  { id: "history", label: "История", title: "История" },
  { id: "analytics", label: "Аналитика", title: "Аналитика" },
  { id: "profile", label: "Профиль", title: "Профиль" },
  { id: "ideas", label: "Идеи", title: "Идеи" },
  { id: "settings", label: "Настройки", title: "Настройки" }
];

export function App() {
  const [activeView, setActiveView] = useState<ReactViewId>("scanner");
  const [selectedTeam, setSelectedTeam] = useState<TeamProfileSelection | null>(null);
  const { settings, setSettings } = useReactSettings();
  const { data, error, loading, refreshing, reload, summary } = useFootballLabData(settings);
  const journal = useJournalHistory(settings, data?.history || []);
  useJournalAutoIngest({
    settings,
    data,
    history: journal.history,
    historySource: journal.source,
    historyLoading: journal.loading,
    onSynced: journal.reload
  });
  const title = useMemo(() => navItems.find((item) => item.id === activeView)?.title || "Сканер матчей", [activeView]);
  const sourceLabel = data?.providerMode === "real" ? "Real API" : "Mock-данные";
  const updatedLabel = data?.lastLoadedAt
    ? `${data.sourceStatus.message} · ${formatTime(data.lastLoadedAt)}`
    : "Ожидаем данные";
  const sourceDetails = data ? formatSourceDetails(data.sourceStatus, data.matches.length) : "Источник не загружен";
  const teamProfile = useMemo(() => {
    if (!data || !selectedTeam) return null;
    return buildTeamProfileViewModel({
      selection: selectedTeam,
      matches: data.matches,
      snapshots: data.snapshots,
      signals: data.signals,
      history: journal.history,
      profiles: data.teamProfiles
    });
  }, [data, journal.history, selectedTeam]);

  return (
    <AppShell
      title={title}
      activeView={activeView}
      navItems={navItems}
      onViewChange={setActiveView}
      onRefresh={reload}
      refreshing={refreshing}
      sourceLabel={sourceLabel}
      updatedLabel={updatedLabel}
      sourceDetails={sourceDetails}
    >
      {loading ? <div className="empty-state">Загружаем данные...</div> : null}
      {error ? <div className="empty-state">{error}</div> : null}
      {data ? (
        <>
          {activeView === "scanner" && teamProfile ? <TeamProfileView profile={teamProfile} onClose={() => setSelectedTeam(null)} /> : null}
          {activeView === "scanner" ? <LiveScannerView matches={data.matches} signals={data.signals} summary={summary} onTeamSelect={setSelectedTeam} /> : null}
          {activeView === "signals" ? <SignalListView matches={data.matches} signals={data.signals} /> : null}
          {activeView === "patterns" ? (
            <PatternLabView
              patterns={data.patterns}
              history={journal.history}
              signals={data.signals}
              settings={settings}
              setSettings={setSettings}
            />
          ) : null}
          {activeView === "history" ? (
            <HistoryView
              history={journal.history}
              source={journal.source}
              loading={journal.loading}
              error={journal.error}
              closingEventId={journal.closingEventId}
              onManualClose={journal.closeEvent}
              onReload={journal.reload}
            />
          ) : null}
          {activeView === "analytics" ? (
            <AnalyticsView
              matches={data.matches}
              snapshots={data.snapshots}
              events={data.events}
              patterns={data.patterns}
              history={journal.history}
              signals={data.signals}
            />
          ) : null}
          {activeView === "profile" ? <ProfileView profile={data.userProfile} history={journal.history} /> : null}
          {activeView === "ideas" ? <IdeasView items={data.feedbackItems} /> : null}
          {activeView === "settings" ? <SettingsView settings={settings} setSettings={setSettings} history={journal.history} /> : null}
          {activeView !== "scanner" && activeView !== "signals" && activeView !== "patterns" && activeView !== "history" && activeView !== "analytics" && activeView !== "profile" && activeView !== "ideas" && activeView !== "settings" ? (
            <section className="panel">
              <p className="eyebrow">Раздел</p>
              <h2>{title}</h2>
              <p className="muted">Данные раздела доступны в основной версии сервиса.</p>
            </section>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSourceDetails(source: FootballDataSourceStatus, matchesCount: number) {
  const cacheLabel = source.cached ? "cache" : "live";
  return `${source.provider} · ${cacheLabel} · ${matchesCount} матчей`;
}
