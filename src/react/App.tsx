import { useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { LiveScannerView } from "./components/LiveScannerView";
import { PatternLabView } from "./components/PatternLabView";
import { SignalListView } from "./components/SignalListView";
import { useFootballLabData } from "./hooks/useFootballLabData";
import type { ReactNavItem, ReactViewId } from "./types";

const navItems: ReactNavItem[] = [
  { id: "scanner", label: "Сканер", title: "Сканер матчей" },
  { id: "signals", label: "Сигналы", title: "Найденные сигналы" },
  { id: "patterns", label: "Паттерны", title: "Паттерны" },
  { id: "history", label: "История", title: "История" },
  { id: "analytics", label: "Аналитика", title: "Аналитика" }
];

export function App() {
  const [activeView, setActiveView] = useState<ReactViewId>("scanner");
  const { data, error, loading, summary } = useFootballLabData();
  const title = useMemo(() => navItems.find((item) => item.id === activeView)?.title || "Сканер матчей", [activeView]);

  return (
    <AppShell title={title} activeView={activeView} navItems={navItems} onViewChange={setActiveView}>
      {loading ? <div className="empty-state">Загружаем данные...</div> : null}
      {error ? <div className="empty-state">{error}</div> : null}
      {data ? (
        <>
          {activeView === "scanner" ? <LiveScannerView matches={data.matches} signals={data.signals} summary={summary} /> : null}
          {activeView === "signals" ? <SignalListView matches={data.matches} signals={data.signals} /> : null}
          {activeView === "patterns" ? <PatternLabView patterns={data.patterns} history={data.history} signals={data.signals} /> : null}
          {activeView !== "scanner" && activeView !== "signals" && activeView !== "patterns" ? (
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
