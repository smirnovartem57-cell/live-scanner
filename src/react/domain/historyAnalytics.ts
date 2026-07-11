import type { PatternEvent } from "../../types/patterns";

export type HistoryFilter = "all" | "win" | "lose" | "open";
export type HistoryPeriod = "today" | "7d" | "all";

export type HistoryStats = {
  total: number;
  win: number;
  lose: number;
  open: number;
  winRate: number;
};

export const historyFilterLabels: Record<HistoryFilter, string> = {
  all: "Все",
  win: "Win",
  lose: "Lose",
  open: "В процессе"
};

export const historyPeriodLabels: Record<HistoryPeriod, string> = {
  today: "Сегодня",
  "7d": "7 дней",
  all: "Все время"
};

export function getHistoryOutcome(event: PatternEvent): Exclude<HistoryFilter, "all"> {
  if (event.result.manualOutcome === "win") return "win";
  if (event.result.manualOutcome === "lose") return "lose";
  if (event.status === "success") return "win";
  if (event.status === "failed") return "lose";
  return "open";
}

export function filterHistory(events: PatternEvent[], filter: HistoryFilter) {
  if (filter === "all") return events;
  return events.filter((event) => getHistoryOutcome(event) === filter);
}

export function filterHistoryByPeriod(events: PatternEvent[], period: HistoryPeriod, nowValue = new Date()) {
  if (period === "all") return events;

  const start = new Date(nowValue);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  }

  if (period === "7d") {
    start.setDate(start.getDate() - 7);
  }

  return events.filter((event) => new Date(event.createdAt).getTime() >= start.getTime());
}

export function getHistoryStats(events: PatternEvent[]): HistoryStats {
  const win = events.filter((event) => getHistoryOutcome(event) === "win").length;
  const lose = events.filter((event) => getHistoryOutcome(event) === "lose").length;
  const open = events.filter((event) => getHistoryOutcome(event) === "open").length;
  const closed = win + lose;

  return {
    total: events.length,
    win,
    lose,
    open,
    winRate: closed ? Math.round((win / closed) * 100) : 0
  };
}

export function formatHistoryOutcome(event: PatternEvent) {
  const outcome = getHistoryOutcome(event);
  if (outcome === "win") return "Win";
  if (outcome === "lose") return "Lose";
  return "В процессе";
}

export function formatHistoryResult(event: PatternEvent) {
  if (event.result.manualOutcome === "win") return "Закрыто вручную: Win";
  if (event.result.manualOutcome === "lose") return "Закрыто вручную: Lose";
  if (event.result.goalWithin5) return "Гол до 5 мин";
  if (event.result.goalWithin10) return "Гол до 10 мин";
  if (event.result.goalWithin15) return "Гол до 15 мин";
  return "Гола нет";
}

export function formatResultSource(event: PatternEvent) {
  if (event.resultSource === "manual" || event.result.manualOutcome) return "Вручную";
  if (event.resultSource === "auto") return "Авто";
  return "Старт";
}

export type HistoryExportFormat = "json" | "csv";

export function buildHistoryExport(params: {
  events: PatternEvent[];
  filter: HistoryFilter;
  period: HistoryPeriod;
  format: HistoryExportFormat;
  getPatternName: (patternType: string) => string;
}) {
  const { events, filter, period, format, getPatternName } = params;
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");

  return {
    filename: `football-pattern-history-${period}-${filter}-${timestamp}.${format}`,
    content: format === "csv" ? historyToCsv(events, getPatternName) : JSON.stringify(events, null, 2),
    type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8"
  };
}

function historyToCsv(events: PatternEvent[], getPatternName: (patternType: string) => string) {
  const headers = [
    "id",
    "matchId",
    "teamId",
    "match",
    "league",
    "minute",
    "pattern",
    "teamSide",
    "signalKind",
    "resultSource",
    "scoreHome",
    "scoreAway",
    "pressureScore",
    "strength",
    "outcome",
    "status",
    "goalWithin5",
    "goalWithin10",
    "goalWithin15",
    "goalMinute",
    "goalTeam",
    "comment",
    "finalComment",
    "createdAt",
    "updatedAt",
    "closedAt"
  ];

  const rows = events.map((event) => [
    event.id,
    event.matchId,
    event.teamId || "",
    event.match,
    event.league,
    event.minute,
    getPatternName(event.patternType),
    event.teamSide,
    event.signalKind,
    formatResultSource(event),
    event.scoreHome,
    event.scoreAway,
    event.pressureScore,
    event.strength,
    getHistoryOutcome(event),
    event.status,
    event.result.goalWithin5,
    event.result.goalWithin10,
    event.result.goalWithin15,
    event.result.goalMinute || "",
    event.result.goalTeam || "",
    event.comment || "",
    event.result.finalComment || "",
    event.createdAt,
    event.updatedAt || "",
    event.closedAt || ""
  ]);

  return `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
