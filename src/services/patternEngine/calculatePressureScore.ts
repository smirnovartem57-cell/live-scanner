import type { TeamStats } from "../../types/football.ts";

export function calculatePressureScore(stats: TeamStats): number {
  const xg = typeof stats.xG === "number" ? stats.xG : stats.xg;
  const possessionBonus = typeof stats.possession === "number"
    ? Math.max(0, stats.possession - 50) * 0.5
    : 0;
  const score =
    (stats.dangerousAttacks || 0) * 0.2 +
    (stats.shotsTotal || 0) * 4 +
    (stats.shotsOnTarget || 0) * 8 +
    (stats.corners || 0) * 5 +
    (typeof xg === "number" ? xg * 12 : 0) +
    possessionBonus;

  return Math.max(0, Math.min(100, Math.round(score)));
}
