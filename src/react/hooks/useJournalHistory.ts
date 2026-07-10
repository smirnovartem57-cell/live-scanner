import { useCallback, useEffect, useMemo, useState } from "react";
import { buildPatternStatsDaily, JournalIngestClient, JournalReadClient } from "../../services/journalStorage";
import type { PatternEvent } from "../../types/patterns";
import type { ReactSettings } from "../domain/settings";

export type JournalHistorySource = "mock" | "supabase";

export function useJournalHistory(settings: ReactSettings, fallbackHistory: PatternEvent[]) {
  const [remoteHistory, setRemoteHistory] = useState<PatternEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [closingEventId, setClosingEventId] = useState<string | null>(null);
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

  const closeEvent = useCallback(async (event: PatternEvent, outcome: "win" | "lose", comment: string) => {
    if (!canReadRemote) {
      setError("Постоянный журнал выключен.");
      return;
    }

    const now = new Date().toISOString();
    const cleanComment = comment.trim();
    const updatedEvent: PatternEvent = {
      ...event,
      status: outcome === "win" ? "success" : "failed",
      comment: cleanComment,
      resultSource: "manual",
      closedAt: now,
      updatedAt: now,
      result: {
        ...event.result,
        manualOutcome: outcome,
        finalComment: cleanComment || `Закрыто вручную: ${outcome === "win" ? "Win" : "Lose"}`
      }
    };

    setClosingEventId(event.id);
    setError(null);

    try {
      const client = new JournalIngestClient({
        supabaseUrl: settings.supabaseUrl.trim(),
        anonKey: settings.supabaseAnonKey.trim()
      });
      const nextHistory = [updatedEvent, ...history.filter((item) => item.id !== event.id)];
      await client.send({
        events: [updatedEvent],
        patternStats: buildPatternStatsDaily(nextHistory),
        ingestionRun: {
          provider: "manual-history-close",
          status: "success",
          signalsCreated: 1,
          message: `Ручное закрытие события: ${outcome === "win" ? "Win" : "Lose"}.`,
          finishedAt: now
        }
      });
      setRemoteHistory(nextHistory);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Не удалось сохранить ручное закрытие.");
    } finally {
      setClosingEventId(null);
    }
  }, [canReadRemote, history, settings.supabaseAnonKey, settings.supabaseUrl]);

  return {
    history,
    source,
    loading,
    error,
    closingEventId,
    closeEvent,
    reload: loadRemoteHistory
  };
}
