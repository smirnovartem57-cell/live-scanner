import { useEffect } from "react";
import {
  buildPatternEvent,
  buildPatternStatsDaily,
  createJournalDedupeKey,
  JournalIngestClient
} from "../../services/journalStorage";
import type { PatternEvent } from "../../types/patterns";
import type { FootballLabViewModel } from "./useFootballLabData";
import type { JournalHistorySource } from "./useJournalHistory";
import type { ReactSettings } from "../domain/settings";

const sentSignalsKey = "football-pattern-lab-journal-auto-ingest";

type JournalAutoIngestOptions = {
  settings: ReactSettings;
  data: FootballLabViewModel | null;
  history: PatternEvent[];
  historySource: JournalHistorySource;
  historyLoading: boolean;
  onSynced: () => void;
};

export function useJournalAutoIngest({
  settings,
  data,
  history,
  historySource,
  historyLoading,
  onSynced
}: JournalAutoIngestOptions) {
  useEffect(() => {
    if (!settings.journalStorageEnabled || historyLoading || historySource !== "supabase" || !data?.signals.length) {
      return;
    }

    const supabaseUrl = settings.supabaseUrl.trim();
    const anonKey = settings.supabaseAnonKey.trim();
    const accessToken = settings.journalAccessToken.trim();
    if (!supabaseUrl || !anonKey) return;

    const currentData = data;
    const sentKeys = readSentKeys();
    const events = currentData.signals
      .map((signal) => {
        const match = currentData.matches.find((item) => item.id === signal.matchId);
        if (!match) return null;
        return buildPatternEvent(signal, match, currentData.events[signal.matchId] || []);
      })
      .filter((event): event is PatternEvent => Boolean(event))
      .filter((event) => !sentKeys.has(getSentKey(event)));

    if (!events.length) return;

    let cancelled = false;

    async function syncSignals() {
      const client = new JournalIngestClient({ supabaseUrl, anonKey, accessToken });
      const patternStats = buildPatternStatsDaily([...history, ...events]);

      await client.send({
        events,
        patternStats,
        ingestionRun: {
          provider: currentData.providerMode === "real" ? "real-football-provider" : "mock-football-provider",
          status: "success",
          matchesSeen: currentData.matches.length,
          signalsCreated: events.length,
          message: "Автоматическая запись найденных сигналов.",
          finishedAt: new Date().toISOString()
        }
      });

      if (cancelled) return;
      rememberSentKeys(events.map(getSentKey));
      onSynced();
    }

    syncSignals().catch((error) => {
      console.warn("Journal auto ingest failed", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    data,
    history,
    historyLoading,
    historySource,
    onSynced,
    settings.journalStorageEnabled,
    settings.journalAccessToken,
    settings.supabaseAnonKey,
    settings.supabaseUrl
  ]);
}

function getSentKey(event: PatternEvent) {
  return createJournalDedupeKey({
    matchId: event.matchId,
    patternId: event.patternId,
    teamSide: event.teamSide,
    createdAt: event.createdAt
  });
}

function readSentKeys() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(sentSignalsKey) || "[]"));
  } catch {
    return new Set<string>();
  }
}

function rememberSentKeys(keys: string[]) {
  const existing = readSentKeys();
  for (const key of keys) {
    existing.add(key);
  }

  const recentKeys = [...existing].slice(-500);
  localStorage.setItem(sentSignalsKey, JSON.stringify(recentKeys));
}
