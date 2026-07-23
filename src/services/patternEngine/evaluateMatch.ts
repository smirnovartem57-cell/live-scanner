import type { Match, MatchStatsSnapshot } from "../../types/football.ts";
import type { Pattern, Signal } from "../../types/patterns.ts";
import { evaluatePattern } from "./evaluatePattern.ts";

const SIGNAL_WINDOW_MINUTES = 10;

export function evaluateMatch(
  match: Match,
  stats: MatchStatsSnapshot,
  patterns: Pattern[],
  existingSignals: Array<Pick<Signal, "matchId" | "patternId" | "teamSide" | "minute">> = []
): Signal[] {
  const signals: Signal[] = [];

  patterns.filter((pattern) => pattern.enabled).forEach((pattern) => {
    (["home", "away"] as const).forEach((teamSide) => {
      const signal = evaluatePattern(match, stats, pattern, teamSide);
      if (signal && !hasDuplicateSignal([...existingSignals, ...signals], signal)) {
        signals.push(signal);
      }
    });
  });

  return signals.sort((a, b) => b.pressureScore - a.pressureScore);
}

function hasDuplicateSignal(
  signals: Array<Pick<Signal, "matchId" | "patternId" | "teamSide" | "minute">>,
  candidate: Pick<Signal, "matchId" | "patternId" | "teamSide" | "minute">
): boolean {
  return signals.some((signal) =>
    signal.matchId === candidate.matchId &&
    signal.patternId === candidate.patternId &&
    signal.teamSide === candidate.teamSide &&
    Math.abs(Number(signal.minute || 0) - Number(candidate.minute || 0)) < SIGNAL_WINDOW_MINUTES
  );
}
