import { calculatePressureScore, type TeamStats } from "./calculatePressureScore";
import { getPatternStatus, type SignalStatus } from "./getPatternStatus";
import { getSignalStrength, type SignalStrength } from "./getSignalStrength";

export type Match = {
  id: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeam: string;
  awayTeam: string;
  minute: number;
  scoreHome: number;
  scoreAway: number;
};

export type MatchStatsSnapshot = {
  matchId: string;
  home: TeamStats;
  away: TeamStats;
  last10?: { home?: TeamStats; away?: TeamStats };
  previous10?: { home?: TeamStats; away?: TeamStats };
  recent?: { home?: TeamStats; away?: TeamStats };
  previous?: { home?: TeamStats; away?: TeamStats };
};

export type Pattern = {
  id: string;
  type: string;
  enabled: boolean;
};

export type Signal = {
  id: string;
  matchId: string;
  patternId: string;
  patternType: string;
  teamId?: string;
  teamSide: "home" | "away";
  minute: number;
  scoreHome: number;
  scoreAway: number;
  pressureScore: number;
  strength: SignalStrength;
  status: SignalStatus;
  signalKind: "signal" | "warning";
  statsAtSignal: TeamStats;
  explanation: string;
  createdAt: string;
  updatedAt: string;
};

const SIGNAL_BUCKET_MINUTES = 10;

export function evaluatePattern(
  match: Match,
  snapshot: MatchStatsSnapshot,
  pattern: Pattern,
  side: "home" | "away",
  now = new Date()
): Signal | null {
  const team = snapshot[side];
  const opponent = snapshot[side === "home" ? "away" : "home"];
  const pressureScore = calculatePressureScore(team);
  const scoreDifference = Math.abs(match.scoreHome - match.scoreAway);
  const teamIsLosing = side === "home" ? match.scoreHome < match.scoreAway : match.scoreAway < match.scoreHome;
  const recent = snapshot.last10?.[side] || snapshot.recent?.[side] || team;
  const previous = snapshot.previous10?.[side] || snapshot.previous?.[side] || team;

  const checks: Record<string, boolean> = {
    pressure_without_goal:
      match.minute >= 25 &&
      match.minute <= 70 &&
      match.scoreHome + match.scoreAway === 0 &&
      (team.dangerousAttacks || 0) >= 50 &&
      (team.shotsTotal || 0) >= 8 &&
      (team.shotsOnTarget || 0) >= 2 &&
      (team.corners || 0) >= 3 &&
      pressureScore >= 70,
    late_goal:
      match.minute >= 65 &&
      scoreDifference <= 1 &&
      (team.dangerousAttacks || 0) >= 45 &&
      (team.shotsTotal || 0) >= 7 &&
      pressureScore >= 65,
    match_woke_up:
      match.minute >= 30 &&
      (recent.dangerousAttacks || 0) >= (previous.dangerousAttacks || 0) * 1.7 &&
      (recent.shotsTotal || 0) >= 2 &&
      pressureScore >= 60,
    favorite_losing_but_pressing:
      teamIsLosing &&
      (team.dangerousAttacks || 0) >= (opponent.dangerousAttacks || 0) * 1.6 &&
      (team.shotsTotal || 0) >= (opponent.shotsTotal || 0) * 1.4 &&
      pressureScore >= 65,
    corner_pressure:
      match.minute >= 20 &&
      (team.attacks || 0) >= 60 &&
      (team.dangerousAttacks || 0) >= 40 &&
      (team.corners || 0) >= 4,
    empty_pressure:
      (team.attacks || 0) >= 70 &&
      (team.dangerousAttacks || 0) >= 45 &&
      (team.shotsOnTarget || 0) <= 1 &&
      (team.corners || 0) <= 2
  };

  if (!checks[pattern.type]) return null;

  return {
    id: `${match.id}-${pattern.id}-${side}-${Math.floor(match.minute / SIGNAL_BUCKET_MINUTES)}`,
    matchId: match.id,
    patternId: pattern.id,
    patternType: pattern.type,
    teamId: side === "home" ? match.homeTeamId : match.awayTeamId,
    teamSide: side,
    minute: match.minute,
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
    pressureScore,
    strength: getSignalStrength(pressureScore),
    status: getPatternStatus(pattern.type),
    signalKind: pattern.type === "empty_pressure" ? "warning" : "signal",
    statsAtSignal: { ...team },
    explanation: buildSignalExplanation(pattern.type, match, team, opponent, side, pressureScore, recent, previous),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

function buildSignalExplanation(
  type: string,
  match: Match,
  team: TeamStats,
  opponent: TeamStats,
  side: "home" | "away",
  pressureScore: number,
  recent: TeamStats,
  previous: TeamStats
): string {
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const score = `${match.scoreHome}:${match.scoreAway}`;
  const recentGrowth = previous.dangerousAttacks
    ? Math.round(((recent.dangerousAttacks || 0) / previous.dangerousAttacks) * 100)
    : 0;

  if (type === "pressure_without_goal") {
    return `${teamName}: счет ${score}, ${(team.dangerousAttacks || 0)} опасных атак, ${(team.shotsTotal || 0)} ударов, ${(team.corners || 0)} угловых, индекс давления ${pressureScore}.`;
  }
  if (type === "late_goal") {
    return `${teamName}: ${match.minute}-я минута, разница в счете не больше одного мяча, индекс давления ${pressureScore}.`;
  }
  if (type === "match_woke_up") {
    return `${teamName}: последние 10 минут активнее предыдущего отрезка, рост опасных атак до ${recentGrowth}%, индекс давления ${pressureScore}.`;
  }
  if (type === "favorite_losing_but_pressing") {
    return `${teamName} уступает в счете, но превосходит соперника по давлению: опасные атаки ${(team.dangerousAttacks || 0)} против ${(opponent.dangerousAttacks || 0)}.`;
  }
  if (type === "corner_pressure") {
    return `${teamName}: ${(team.attacks || 0)} атак, ${(team.dangerousAttacks || 0)} опасных атак и ${(team.corners || 0)} угловых.`;
  }
  if (type === "empty_pressure") {
    return `${teamName}: атак много, но ударов в створ ${(team.shotsOnTarget || 0)} и угловых ${(team.corners || 0)}. Это предупреждение о низком качестве давления.`;
  }

  return `${teamName}: найдено совпадение с условиями паттерна, индекс давления ${pressureScore}.`;
}
