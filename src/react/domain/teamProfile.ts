import { calculatePressureScore } from "../../services/patternEngine";
import type { Match, MatchStatsSnapshot, TeamProfile, TeamSide, TeamStats } from "../../types/football";
import type { PatternEvent, Signal } from "../../types/patterns";
import { getHistoryStats, type HistoryStats } from "./historyAnalytics";

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
    match,
    stats,
    opponentName,
    pressureScore,
    pressureGap,
    signals: teamSignals,
    historyStats: getHistoryStats(teamHistory),
    summary: `${teamName} против ${opponentName}: ${stats.dangerousAttacks || 0} опасных атак, ${stats.shotsTotal || 0} ударов, ${stats.shotsOnTarget || 0} в створ, ${stats.corners || 0} угловых. Разница индекса с соперником: ${pressureGap > 0 ? "+" : ""}${pressureGap}, ${trend}.`
  };
}

function getTrendLabel(snapshot: MatchStatsSnapshot, side: TeamSide) {
  const recent = snapshot.recent?.[side] || snapshot.last10?.[side];
  const previous = snapshot.previous?.[side] || snapshot.previous10?.[side];

  if (!recent || !previous) return "темп без явного изменения";
  return (recent.dangerousAttacks || 0) >= (previous.dangerousAttacks || 0)
    ? "темп растет"
    : "темп стабильный или ниже";
}
