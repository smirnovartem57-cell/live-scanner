import type { Match, MatchEvent, MatchStatsSnapshot } from "../../types/football";

export type DataQualityStatus = "working" | "testing" | "weak";

export type DataQualityStats = {
  matches: number;
  snapshots: number;
  eventMatches: number;
  statsCoverage: number;
  eventsCoverage: number;
  freshnessLabel: string;
  lastUpdatedLabel: string;
  healthScore: number;
  status: DataQualityStatus;
  label: string;
  summary: string;
};

export function getDataQualityStats(
  matches: Match[],
  snapshots: MatchStatsSnapshot[],
  events: Record<string, MatchEvent[]> = {}
): DataQualityStats {
  const matchesCount = matches.length;
  const eventMatches = Object.values(events).filter((items) => items.length > 0).length;
  const statsCoverage = getRate(snapshots.length, matchesCount || 1);
  const eventsCoverage = getRate(eventMatches, matchesCount || 1);
  const updatedTimes = matches
    .map((match) => new Date(match.updatedAt || Date.now()).getTime())
    .filter(Number.isFinite);
  const lastUpdated = updatedTimes.length ? new Date(Math.max(...updatedTimes)) : new Date();
  const ageMinutes = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 60000));
  const freshnessScore = ageMinutes <= 3 ? 100 : ageMinutes <= 10 ? 70 : 35;
  const healthScore = Math.round((statsCoverage * 0.45) + (eventsCoverage * 0.25) + (freshnessScore * 0.3));
  const status = healthScore >= 85 ? "working" : healthScore >= 65 ? "testing" : "weak";
  const labels: Record<DataQualityStatus, string> = {
    working: "Источник готов",
    testing: "Нужно наблюдение",
    weak: "Есть пробелы"
  };

  return {
    matches: matchesCount,
    snapshots: snapshots.length,
    eventMatches,
    statsCoverage,
    eventsCoverage,
    freshnessLabel: ageMinutes <= 1 ? "сейчас" : `${ageMinutes} мин`,
    lastUpdatedLabel: lastUpdated.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }),
    healthScore,
    status,
    label: labels[status],
    summary: `Покрытие статистики ${statsCoverage}%, покрытие событий ${eventsCoverage}%, оценка качества ${healthScore}/100.`
  };
}

function getRate(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
