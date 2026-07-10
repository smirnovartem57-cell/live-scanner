import { useCallback, useEffect, useMemo, useState } from "react";
import { JournalReadClient } from "../../services/journalStorage";
import type { PatternEvent } from "../../types/patterns";
import type { ReactSettings } from "../domain/settings";

export type JournalHistorySource = "mock" | "supabase";

export function useJournalHistory(settings: ReactSettings, fallbackHistory: PatternEvent[]) {
  const [remoteHistory, setRemoteHistory] = useState<PatternEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReadRemote = settings.journalStorageEnabled && Boolean(settings.supabaseUrl.trim()) && Boolean(settings.supabaseAnonKey.trim());

  const loadRemoteHistory = useCallback(async () => {
    if (!canReadRemote) {
      setRemoteHistory(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = new JournalReadClient({
        supabaseUrl: settings.supabaseUrl.trim(),
        anonKey: settings.supabaseAnonKey.trim()
      });
      const result = await client.read({ limit: 200, includePatternStats: true, patternStatsDays: 30 });
      setRemoteHistory(result.history);
    } catch (loadError) {
      setRemoteHistory(null);
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить постоянный журнал.");
    } finally {
      setLoading(false);
    }
  }, [canReadRemote, settings.supabaseAnonKey, settings.supabaseUrl]);

  useEffect(() => {
    loadRemoteHistory();
  }, [loadRemoteHistory]);

  const history = useMemo(() => remoteHistory || fallbackHistory, [remoteHistory, fallbackHistory]);
  const source: JournalHistorySource = remoteHistory ? "supabase" : "mock";

  return {
    history,
    source,
    loading,
    error,
    reload: loadRemoteHistory
  };
}
