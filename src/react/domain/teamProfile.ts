import { calculatePressureScore } from "../../services/patternEngine";
import type { Match, MatchStatsSnapshot, TeamPatternSummary, TeamProfile, TeamSide, TeamStats } from "../../types/football";
import type { PatternEvent, Signal } from "../../types/patterns";
import { getHistoryStats, type HistoryStats } from "./historyAnalytics";
import { getPatternName } from "./labels";

export type TeamProfileSelection = {
  matchId: string;
  side: TeamSide;
  teamId?: string;
};

export type TeamProfileViewModel = TeamProfile & {
  match: Match;
  stats: TeamStats;
  opponentName: string;
  pressureScore: number;
  pressureGap: number;
  signals: Signal[];
  historyStats: HistoryStats;
  summary: string;
};

export function buildTeamProfileViewModel(params: {
  selection: TeamProfileSelection;
  matches: Match[];
  snapshots: MatchStatsSnapshot[];
  signals: Signal[];
  history: PatternEvent[];
  profiles: TeamProfile[];
}): TeamProfileViewModel | null {
  const match = params.matches.find((item) => item.id === params.selection.matchId);
  const snapshot = params.snapshots.find((item) => item.matchId === params.selection.matchId);
  if (!match || !snapshot) return null;

  const side = params.selection.side;
  const opponentSide = side === "home" ? "away" : "home";
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const opponentName = side === "home" ? match.awayTeam : match.homeTeam;
  const teamId = params.selection.teamId || (side === "home" ? match.homeTeamId : match.awayTeamId) || teamName;
  const providerProfile = params.profiles.find((profile) => profile.id === teamId);
  const stats = snapshot[side];
  const opponent = snapshot[opponentSide];
  const pressureScore = calculatePressureScore(stats);
  const opponentPressureScore = calculatePressureScore(opponent);
  const pressureGap = pressureScore - opponentPressureScore;
  const teamSignals = params.signals.filter((signal) => signal.matchId === match.id && signal.teamSide === side);
  const teamHistory = params.history.filter((event) => event.teamId === teamId || event.match.includes(teamName));
  const characteristicPatterns = providerProfile?.characteristicPatterns?.length
    ? providerProfile.characteristicPatterns
    : buildPatternSummaries(teamHistory, teamId);
  const trend = getTrendLabel(snapshot, side);

  return {
    ...(providerProfile || {
      id: teamId,
      name: teamName,
      league: match.league,
      country: match.country,
      logo: teamName.slice(0, 3).toUpperCase()
    }),
    id: teamId,
    name: providerProfile?.name || teamName,
    league: providerProfile?.league || match.league,
    country: providerProfile?.country || match.country,
    logo: providerProfile?.logo || teamName.slice(0, 3).toUpperCase(),
    characteristicPatterns,
    match,
    stats,
    opponentName,
    pressureScore,
    pressureGap,
    signals: teamSignals,
    historyStats: getHistoryStats(teamHistory),
    summary: `${teamName} против ${opponentName}: ${formatMetric(stats.shotsTotal)} ударов, ${formatMetric(stats.shotsOnTarget)} в створ, ${formatMetric(stats.corners)} угловых, ${formatMetric(stats.possession, "%")} владения. Разница индекса с соперником: ${pressureGap > 0 ? "+" : ""}${pressureGap}, ${trend}.`
  };
}

function getTrendLabel(snapshot: MatchStatsSnapshot, side: TeamSide) {
  const recent = snapshot.recent?.[side] || snapshot.last10?.[side];
  const previous = snapshot.previous?.[side] || snapshot.previous10?.[side];

  if (!recent || !previous) return "доступен текущий накопительный срез";
  return (recent.shotsTotal || 0) >= (previous.shotsTotal || 0)
    ? "темп растёт"
    : "темп стабильный или ниже";
}

function formatMetric(value: number | undefined, suffix = "") {
  return typeof value === "number" ? `${value}${suffix}` : "нет данных";
}

function buildPatternSummaries(history: PatternEvent[], teamId: string): TeamPatternSummary[] {
  const groups = new Map<string, PatternEvent[]>();
  for (const event of history) {
    groups.set(event.patternId, [...(groups.get(event.patternId) || []), event]);
  }

  return [...groups.entries()].map(([patternId, events]) => {
    const totalSignals = events.length;
    const successWithin10 = events.filter((event) => event.result.goalWithin10).length;
    const successWithin15 = events.filter((event) => event.result.goalWithin15).length;
    const successRate10 = Math.round((successWithin10 / totalSignals) * 100);
    const successRate15 = Math.round((successWithin15 / totalSignals) * 100);
    return {
      teamId,
      patternId,
      patternName: getPatternName(events[0]?.patternType || patternId),
      totalSignals,
      successWithin10,
      successWithin15,
      successRate10,
      successRate15,
      averageMinute: Math.round(events.reduce((sum, event) => sum + event.minute, 0) / totalSignals),
      averagePressureScore: Math.round(events.reduce((sum, event) => sum + event.pressureScore, 0) / totalSignals),
      label: totalSignals < 3
        ? "not_enough_data"
        : successRate15 >= 60
          ? "strong"
          : successRate15 >= 35
            ? "normal"
            : "weak"
    };
  });
}
