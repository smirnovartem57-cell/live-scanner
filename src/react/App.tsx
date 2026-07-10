import { AppShell } from "./components/AppShell";
import { LiveScannerView } from "./components/LiveScannerView";
import { useFootballLabData } from "./hooks/useFootballLabData";

export function App() {
  const { data, error, loading, summary } = useFootballLabData();

  return (
    <AppShell title="Сканер матчей">
      {loading ? <div className="empty-state">Загружаем данные...</div> : null}
      {error ? <div className="empty-state">{error}</div> : null}
      {data ? <LiveScannerView matches={data.matches} signals={data.signals} summary={summary} /> : null}
    </AppShell>
  );
}
