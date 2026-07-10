import type { Match, MatchStatsSnapshot, TeamSide, TeamStats } from "../../types/football";
import type { Pattern, PatternRule, Signal } from "../../types/patterns";
import { calculatePressureScore } from "./calculatePressureScore";
import { getPatternStatus } from "./getPatternStatus";
import { getSignalStrength } from "./getSignalStrength";

const SIGNAL_BUCKET_MINUTES = 10;

export function evaluatePattern(
  match: Match,
  snapshot: MatchStatsSnapshot,
  pattern: Pattern,
  side: TeamSide,
  now = new Date()
): Signal | null {
  const team = snapshot[side];
  const opponent = snapshot[side === "home" ? "away" : "home"];
  const pressureScore = calculatePressureScore(team);
  const scoreDifference = Math.abs(match.scoreHome - match.scoreAway);
  const teamIsLosing = side === "home" ? match.scoreHome < match.scoreAway : match.scoreAway < match.scoreHome;
  const recent = snapshot.last10?.[side] || snapshot.recent?.[side] || team;
  const previous = snapshot.previous10?.[side] || snapshot.previous?.[side] || team;
  const rules = getRuleValues(pattern);

  const checks: Record<string, boolean> = {
    pressure_without_goal:
      match.minute >= getRuleValue(rules, "minute", ">=", 25) &&
      match.minute <= getRuleValue(rules, "minute", "<=", 70) &&
      match.scoreHome + match.scoreAway === getRuleValue(rules, "scoreTotal", "==", 0) &&
      (team.dangerousAttacks || 0) >= getRuleValue(rules, "dangerousAttacks", ">=", 50) &&
      (team.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 8) &&
      (team.shotsOnTarget || 0) >= getRuleValue(rules, "shotsOnTarget", ">=", 2) &&
      (team.corners || 0) >= getRuleValue(rules, "corners", ">=", 3) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 70),
    late_goal:
      match.minute >= getRuleValue(rules, "minute", ">=", 65) &&
      scoreDifference <= getRuleValue(rules, "scoreDiff", "<=", 1) &&
      (team.dangerousAttacks || 0) >= getRuleValue(rules, "dangerousAttacks", ">=", 45) &&
      (team.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 7) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 65),
    match_woke_up:
      match.minute >= getRuleValue(rules, "minute", ">=", 30) &&
      (recent.dangerousAttacks || 0) >= (previous.dangerousAttacks || 0) * getRuleValue(rules, "dangerousAttacks", ">=", 1.7, "last_10") &&
      (recent.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 2, "last_10") &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 60),
    favorite_losing_but_pressing:
      teamIsLosing &&
      (team.dangerousAttacks || 0) >= (opponent.dangerousAttacks || 0) * getRuleValue(rules, "dangerousRatio", ">=", 1.6) &&
      (team.shotsTotal || 0) >= (opponent.shotsTotal || 0) * getRuleValue(rules, "shotsRatio", ">=", 1.4) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 65),
    corner_pressure:
      match.minute >= getRuleValue(rules, "minute", ">=", 20) &&
      (team.attacks || 0) >= getRuleValue(rules, "attacks", ">=", 60) &&
      (team.dangerousAttacks || 0) >= getRuleValue(rules, "dangerousAttacks", ">=", 40) &&
      (team.corners || 0) >= getRuleValue(rules, "corners", ">=", 4),
    empty_pressure:
      (team.attacks || 0) >= getRuleValue(rules, "attacks", ">=", 70) &&
      (team.dangerousAttacks || 0) >= getRuleValue(rules, "dangerousAttacks", ">=", 45) &&
      (team.shotsOnTarget || 0) <= getRuleValue(rules, "shotsOnTarget", "<=", 1) &&
      (team.corners || 0) <= getRuleValue(rules, "corners", "<=", 2)
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

function getRuleValues(pattern: Pattern): Array<PatternRule & { numericValue: number | null }> {
  return (pattern.rules || []).map((rule) => ({
    ...rule,
    numericValue: parseRuleNumber(rule.value)
  }));
}

function getRuleValue(
  rules: Array<PatternRule & { numericValue: number | null }>,
  field: string,
  operator: string,
  fallback: number,
  period: string | null = null
): number {
  const rule = rules.find((item) =>
    item.field === field &&
    item.operator === operator &&
    (period ? item.period === period : !item.period)
  );
  return typeof rule?.numericValue === "number" ? rule.numericValue : fallback;
}

function parseRuleNumber(value: number | string): number | null {
  if (typeof value === "number") return value;
  const clean = String(value).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return clean ? Number(clean[0]) : null;
}

function buildSignalExplanation(
  type: string,
  match: Match,
  team: TeamStats,
  opponent: TeamStats,
  side: TeamSide,
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
