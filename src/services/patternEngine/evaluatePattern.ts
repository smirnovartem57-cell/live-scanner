import type { Match, MatchStatsSnapshot, TeamSide, TeamStats } from "../../types/football.ts";
import type { Pattern, PatternRule, Signal } from "../../types/patterns.ts";
import { calculatePressureScore } from "./calculatePressureScore.ts";
import { getPatternStatus } from "./getPatternStatus.ts";
import { getSignalStrength } from "./getSignalStrength.ts";

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
  const rules = getRuleValues(pattern);

  const checks: Record<string, boolean> = {
    pressure_without_goal:
      match.minute >= getRuleValue(rules, "minute", ">=", 25) &&
      match.minute <= getRuleValue(rules, "minute", "<=", 75) &&
      match.scoreHome + match.scoreAway === getRuleValue(rules, "scoreTotal", "==", 0) &&
      (team.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 8) &&
      (team.shotsOnTarget || 0) >= getRuleValue(rules, "shotsOnTarget", ">=", 2) &&
      (team.corners || 0) >= getRuleValue(rules, "corners", ">=", 3) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 55),
    late_goal:
      match.minute >= getRuleValue(rules, "minute", ">=", 65) &&
      scoreDifference <= getRuleValue(rules, "scoreDiff", "<=", 1) &&
      (team.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 7) &&
      (team.shotsOnTarget || 0) >= getRuleValue(rules, "shotsOnTarget", ">=", 2) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 50),
    match_woke_up:
      match.minute >= getRuleValue(rules, "minute", ">=", 30) &&
      (team.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 6) &&
      (team.shotsOnTarget || 0) >= getRuleValue(rules, "shotsOnTarget", ">=", 2) &&
      (team.corners || 0) >= getRuleValue(rules, "corners", ">=", 2) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 45),
    favorite_losing_but_pressing:
      teamIsLosing &&
      (team.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 5) &&
      (team.shotsTotal || 0) >= (opponent.shotsTotal || 0) * getRuleValue(rules, "shotsRatio", ">=", 1.4) &&
      (team.shotsOnTarget || 0) >= getRuleValue(rules, "shotsOnTarget", ">=", 2) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 45),
    corner_pressure:
      match.minute >= getRuleValue(rules, "minute", ">=", 20) &&
      (team.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 6) &&
      (team.corners || 0) >= getRuleValue(rules, "corners", ">=", 4) &&
      (team.possession || 0) >= getRuleValue(rules, "possession", ">=", 52),
    empty_pressure:
      (team.possession || 0) >= getRuleValue(rules, "possession", ">=", 58) &&
      (team.shotsTotal || 0) >= getRuleValue(rules, "shotsTotal", ">=", 7) &&
      (team.shotsOnTarget || 0) <= getRuleValue(rules, "shotsOnTarget", "<=", 1) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 30)
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
    explanation: buildSignalExplanation(pattern.type, match, team, opponent, side, pressureScore),
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
  pressureScore: number
): string {
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const score = `${match.scoreHome}:${match.scoreAway}`;
  if (type === "pressure_without_goal") {
    return `${teamName}: счет ${score}, ${(team.shotsTotal || 0)} ударов, ${(team.shotsOnTarget || 0)} в створ, ${(team.corners || 0)} угловых, индекс давления ${pressureScore}.`;
  }
  if (type === "late_goal") {
    return `${teamName}: ${match.minute}-я минута, разница в счете не больше одного мяча, индекс давления ${pressureScore}.`;
  }
  if (type === "match_woke_up") {
    return `${teamName}: плотная атакующая активность — ${(team.shotsTotal || 0)} ударов, ${(team.shotsOnTarget || 0)} в створ и ${(team.corners || 0)} угловых, индекс ${pressureScore}.`;
  }
  if (type === "favorite_losing_but_pressing") {
    return `${teamName} уступает в счёте, но превосходит соперника по ударам: ${(team.shotsTotal || 0)} против ${(opponent.shotsTotal || 0)}, индекс ${pressureScore}.`;
  }
  if (type === "corner_pressure") {
    return `${teamName}: ${(team.shotsTotal || 0)} ударов, ${(team.corners || 0)} угловых и ${(team.possession || 0)}% владения.`;
  }
  if (type === "empty_pressure") {
    return `${teamName}: владение ${(team.possession || 0)}%, ударов ${(team.shotsTotal || 0)}, но в створ только ${(team.shotsOnTarget || 0)}. Это предупреждение о низком качестве давления.`;
  }

  return `${teamName}: найдено совпадение с условиями паттерна, индекс давления ${pressureScore}.`;
}
