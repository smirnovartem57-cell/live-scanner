import { useEffect } from "react";
import {
  buildPatternEvent,
  buildPatternStatsDaily,
  createJournalDedupeKey,
  JournalIngestClient
} from "../../services/journalStorage";
import type { PatternEvent } from "../../types/patterns";
import { canUseJournalStorage, getJournalAccessToken } from "../domain/settings";
import type { ReactSettings } from "../domain/settings";
import type { FootballLabViewModel } from "./useFootballLabData";
import type { JournalHistorySource } from "./useJournalHistory";

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
    if (!canUseJournalStorage(settings) || historyLoading || historySource !== "supabase" || !data?.signals.length) {
      return;
    }

    const supabaseUrl = settings.supabaseUrl.trim();
    const anonKey = settings.supabaseAnonKey.trim();
    const accessToken = getJournalAccessToken(settings);

    const currentData = data;
    const sentKeys = readSentKeys();
    const newEvents = currentData.signals
      .map((signal) => {
        const match = currentData.matches.find((item) => item.id === signal.matchId);
        if (!match) return null;
        return buildPatternEvent(signal, match, currentData.events[signal.matchId] || []);
      })
      .filter((event): event is PatternEvent => Boolean(event))
      .filter((event) => !sentKeys.has(getSentKey(event)));

    const updatedEvents = history
      .filter((event) => event.resultSource === "auto" && !event.result.manualOutcome)
      .filter((event) => event.status === "new" || event.status === "in_progress")
      .map((event) => {
        const match = currentData.matches.find((item) => item.id === event.matchId);
        if (!match) return null;
        const updated = buildPatternEvent(event, match, currentData.events[event.matchId] || []);
        return hasResultChanged(event, updated) ? updated : null;
      })
      .filter((event): event is PatternEvent => Boolean(event));

    const events = [...newEvents, ...updatedEvents];

    if (!events.length) return;

    let cancelled = false;

    async function syncSignals() {
      const client = new JournalIngestClient({ supabaseUrl, anonKey, accessToken });
      const nextHistory = mergeHistory(history, events);
      const patternStats = buildPatternStatsDaily(nextHistory);

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

function hasResultChanged(previous: PatternEvent, next: PatternEvent) {
  return previous.status !== next.status ||
    previous.result.goalWithin5 !== next.result.goalWithin5 ||
    previous.result.goalWithin10 !== next.result.goalWithin10 ||
    previous.result.goalWithin15 !== next.result.goalWithin15 ||
    previous.result.goalMinute !== next.result.goalMinute ||
    previous.result.goalTeam !== next.result.goalTeam ||
    previous.result.finalComment !== next.result.finalComment;
}

function mergeHistory(history: PatternEvent[], updates: PatternEvent[]) {
  const byId = new Map(history.map((event) => [event.id, event]));
  for (const event of updates) {
    byId.set(event.id, event);
  }
  return [...byId.values()];
}
