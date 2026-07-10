import type { PatternEvent } from "../../types/patterns";

export type HistoryFilter = "all" | "win" | "lose" | "open";

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
