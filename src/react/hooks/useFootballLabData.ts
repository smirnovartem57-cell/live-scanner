import { useEffect, useMemo, useState } from "react";
import { MockFootballProvider } from "../../services/footballDataProvider";
import { evaluateMatch } from "../../services/patternEngine";
import type { Match, MatchEvent, MatchStatsSnapshot } from "../../types/football";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import { getBrowserMockData } from "../mockData";

export type FootballLabViewModel = {
  matches: Match[];
  snapshots: MatchStatsSnapshot[];
  events: Record<string, MatchEvent[]>;
  patterns: Pattern[];
  signals: Signal[];
  history: PatternEvent[];
};

export type FootballLabSummary = {
  matchesCount: number;
  activeSignalsCount: number;
  highSignalsCount: number;
  patternsCount: number;
};

export function useFootballLabData() {
  const [data, setData] = useState<FootballLabViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const provider = new MockFootballProvider(getBrowserMockData());
        const [matches, snapshots, eventsResult, patterns, seedSignals, history] = await Promise.all([
          provider.getLiveMatches(),
          provider.getMatchStats(),
          provider.getMatchEvents(),
          provider.getPatterns(),
          provider.getSeedSignals(),
          provider.getSeedHistory()
        ]);
        const events = Array.isArray(eventsResult) ? {} : eventsResult;
        const generatedSignals = buildGeneratedSignals(matches, snapshots, patterns, seedSignals);

        if (!cancelled) {
          setData({
            matches,
            snapshots,
            events,
            patterns,
            signals: [...seedSignals, ...generatedSignals],
            history
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные.");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo<FootballLabSummary>(() => {
    const signals = data?.signals || [];

    return {
      matchesCount: data?.matches.length || 0,
      activeSignalsCount: signals.length,
      highSignalsCount: signals.filter((signal) => signal.strength === "HIGH").length,
      patternsCount: data?.patterns.filter((pattern) => pattern.enabled).length || 0
    };
  }, [data]);

  return { data, error, loading: !data && !error, summary };
}

function buildGeneratedSignals(
  matches: Match[],
  snapshots: MatchStatsSnapshot[],
  patterns: Pattern[],
  seedSignals: Signal[]
): Signal[] {
  return snapshots.reduce<Signal[]>((signals, snapshot) => {
    const match = matches.find((item) => item.id === snapshot.matchId);
    if (!match) return signals;

    return [
      ...signals,
      ...evaluateMatch(match, snapshot, patterns, [...seedSignals, ...signals])
    ];
  }, []);
}
