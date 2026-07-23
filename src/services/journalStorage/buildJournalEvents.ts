import type { Match, MatchEvent } from "../../types/football";
import type { PatternEvent, Signal, SignalResult, SignalStatus } from "../../types/patterns";
import type { PatternStatsDaily } from "./JournalStorage";

export function buildPatternEvent(signal: Signal, match: Match, events: MatchEvent[] = []): PatternEvent {
  const evaluated = evaluateSignalResult(signal, match, events);
  const previousEvent = "result" in signal ? signal as PatternEvent : null;
  const resultChanged = previousEvent
    ? previousEvent.status !== evaluated.status || JSON.stringify(previousEvent.result) !== JSON.stringify(evaluated.result)
    : false;
  const updatedAt = resultChanged ? new Date().toISOString() : signal.updatedAt;

  return {
    ...signal,
    match: `${match.homeTeam} - ${match.awayTeam}`,
    league: match.league,
    score: `${signal.scoreHome}:${signal.scoreAway}`,
    status: evaluated.status,
    result: evaluated.result,
    updatedAt,
    comment: previousEvent?.comment || "",
    resultSource: previousEvent?.resultSource || "auto",
    closedAt: ["success", "failed"].includes(evaluated.status)
      ? previousEvent?.closedAt || updatedAt
      : null
  };
}

export function buildPatternStatsDaily(history: PatternEvent[]): PatternStatsDaily[] {
  const groups = new Map<string, PatternEvent[]>();

  for (const event of history) {
    const statDate = event.createdAt.slice(0, 10);
    const key = `${statDate}:${event.patternId}`;
    groups.set(key, [...(groups.get(key) || []), event]);
  }

  return [...groups.entries()].map(([key, events]) => {
    const [statDate] = key.split(":");
    const failedSignals = events.filter((event) => event.status === "failed" || event.result.manualOutcome === "lose").length;
    const closedSignals = events.filter((event) => ["success", "failed"].includes(event.status) || event.result.manualOutcome).length;
    const successWithin15 = events.filter((event) => event.result.goalWithin15 || event.result.manualOutcome === "win").length;

    return {
      statDate,
      patternId: events[0].patternId,
      patternType: events[0].patternType,
      totalSignals: events.length,
      successWithin5: events.filter((event) => event.result.goalWithin5).length,
      successWithin10: events.filter((event) => event.result.goalWithin10).length,
      successWithin15,
      failedSignals,
      warningSignals: events.filter((event) => event.signalKind === "warning").length,
      averagePressureScore: average(events.map((event) => event.pressureScore)),
      averageMinute: average(events.map((event) => event.minute)),
      qualityScore: closedSignals ? Math.round((successWithin15 / closedSignals) * 100) : 0
    };
  });
}

function evaluateSignalResult(signal: Signal, match: Match, events: MatchEvent[]) {
  const result: SignalResult = {
    goalWithin5: false,
    goalWithin10: false,
    goalWithin15: false,
    goalMinute: null,
    goalTeam: null,
    finalComment: "",
    manualOutcome: null
  };

  const goalsAfterSignal = events
    .filter((event) => event.type === "goal")
    .filter((event) => event.minute > signal.minute)
    .filter((event) => event.minute <= Math.min(match.minute, signal.minute + 15))
    .sort((a, b) => a.minute - b.minute);

  const firstGoal = goalsAfterSignal[0];
  if (firstGoal) {
    const delta = firstGoal.minute - signal.minute;
    result.goalWithin5 = delta <= 5;
    result.goalWithin10 = delta <= 10;
    result.goalWithin15 = delta <= 15;
    result.goalMinute = firstGoal.minute;
    result.goalTeam = firstGoal.teamSide || null;
  }

  const windowClosed = match.minute >= signal.minute + 15 || match.status === "finished";
  const isWarning = signal.signalKind === "warning" || signal.patternType === "empty_pressure";
  let status: SignalStatus = signal.status || "in_progress";

  if (isWarning) {
    if (result.goalWithin15) {
      status = "failed";
      result.finalComment = "Предупреждение не подтвердилось: в течение 15 минут был гол.";
    } else if (windowClosed) {
      status = "success";
      result.finalComment = "Предупреждение подтвердилось: за 15 минут гола не было.";
    } else {
      status = "new";
    }
  } else if (result.goalWithin15) {
    status = "success";
    result.finalComment = "Сигнал подтвердился событием в окне до 15 минут.";
  } else if (windowClosed) {
    status = "failed";
    result.finalComment = "Окно 15 минут закрылось без подтверждения.";
  } else {
    status = "in_progress";
  }

  return { status, result };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
