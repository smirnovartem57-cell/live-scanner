import type { Pattern, PatternEvent, Signal } from "../../types/patterns";

export type ReactPatternStatus = "new" | "promising" | "working" | "weak" | "ineffective" | "testing";

export type ReactPatternStats = {
  pattern: Pattern;
  totalSignals: number;
  activeSignals: number;
  successWithin5: number;
  successWithin10: number;
  successWithin15: number;
  failedSignals: number;
  pendingSignals: number;
  successRate15: number;
  averageMinute: number;
  averagePressureScore: number;
  qualityScore: number;
  status: ReactPatternStatus;
  reason: string;
};

export const patternStatusLabel: Record<ReactPatternStatus, string> = {
  new: "Новый",
  promising: "Перспективный",
  working: "Рабочий",
  weak: "Слабый",
  ineffective: "Неэффективный",
  testing: "На проверке"
};

export function getReactPatternStats(pattern: Pattern, history: PatternEvent[], signals: Signal[]): ReactPatternStats {
  const patternHistory = history.filter((event) => event.patternId === pattern.id);
  const patternSignals = signals.filter((signal) => signal.patternId === pattern.id);
  const totalSignals = patternHistory.length;
  const successWithin5 = patternHistory.filter((event) => event.result.goalWithin5).length;
  const successWithin10 = patternHistory.filter((event) => event.result.goalWithin10).length;
  const successWithin15 = patternHistory.filter((event) => event.result.goalWithin15).length;
  const failedSignals = patternHistory.filter((event) => getEventOutcome(event) === "lose").length;
  const pendingSignals = patternHistory.filter((event) => getEventOutcome(event) === "open").length;
  const successRate15 = getRate(successWithin15, totalSignals);
  const averageMinute = getAverage(patternHistory.map((event) => event.minute));
  const averagePressureScore = getAverage(patternHistory.map((event) => event.pressureScore).filter(Boolean));
  const qualityScore = getPatternQualityScore({
    totalSignals,
    successRate15,
    failedSignals,
    pendingSignals,
    averagePressureScore
  });
  const status = getPatternAnalyticsStatus(pattern, totalSignals, successRate15);

  return {
    pattern,
    totalSignals,
    activeSignals: patternSignals.length,
    successWithin5,
    successWithin10,
    successWithin15,
    failedSignals,
    pendingSignals,
    successRate15,
    averageMinute,
    averagePressureScore,
    qualityScore,
    status,
    reason: getPatternStatusReason(status, totalSignals, successRate15)
  };
}

export function getRuleText(rule: Pattern["rules"][number]) {
  const period = rule.period ? ` · ${rule.period}` : "";
  return `${rule.field} ${rule.operator} ${rule.value}${period}`;
}

function getPatternAnalyticsStatus(pattern: Pattern, totalSignals: number, successRate15: number): ReactPatternStatus {
  if (pattern.analyticsStatus === "testing") return "testing";
  if (totalSignals < 30) return "new";
  if (totalSignals < 100 && successRate15 >= 35) return "promising";
  if (totalSignals >= 100 && successRate15 >= 35) return "working";
  if (totalSignals >= 100 && successRate15 >= 20) return "weak";
  if (totalSignals >= 100 && successRate15 < 20) return "ineffective";
  return "testing";
}

function getPatternStatusReason(status: ReactPatternStatus, totalSignals: number, successRate15: number) {
  if (status === "new") return `Сигналов ${totalSignals}. Нужна большая выборка.`;
  if (status === "promising") return `До 15 минут ${successRate15}%, выборка растет.`;
  if (status === "working") return `До 15 минут ${successRate15}%, выборка ${totalSignals}.`;
  if (status === "weak") return `До 15 минут ${successRate15}%, стоит наблюдать условия.`;
  if (status === "ineffective") return `До 15 минут ${successRate15}%, паттерн требует пересмотра.`;
  return "Паттерн изменен или находится в ручной проверке.";
}

function getPatternQualityScore(stats: {
  totalSignals: number;
  successRate15: number;
  failedSignals: number;
  pendingSignals: number;
  averagePressureScore: number;
}) {
  const sampleScore = Math.min(100, stats.totalSignals * 3);
  const confirmationScore = stats.successRate15;
  const pressureScore = Math.min(100, stats.averagePressureScore || 0);
  const failedPenalty = stats.totalSignals ? Math.round((stats.failedSignals / stats.totalSignals) * 35) : 0;
  const pendingPenalty = stats.totalSignals ? Math.round((stats.pendingSignals / stats.totalSignals) * 12) : 0;
  const score = Math.round((confirmationScore * 0.5) + (sampleScore * 0.25) + (pressureScore * 0.25) - failedPenalty - pendingPenalty);
  return Math.max(0, Math.min(100, score));
}

function getEventOutcome(event: PatternEvent) {
  if (event.result.manualOutcome === "win") return "win";
  if (event.result.manualOutcome === "lose") return "lose";
  if (event.status === "success") return "win";
  if (event.status === "failed") return "lose";
  return "open";
}

function getRate(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function getAverage(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length) : 0;
}
