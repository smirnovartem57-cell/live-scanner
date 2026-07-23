import type { TeamStats } from "../../types/football.ts";

export function calculatePressureScore(stats: TeamStats): number {
  const xg = typeof stats.xG === "number" ? stats.xG : stats.xg;
  const score =
    (stats.dangerousAttacks || 0) * 0.8 +
    (stats.shotsTotal || 0) * 3 +
    (stats.shotsOnTarget || 0) * 6 +
    (stats.corners || 0) * 4 +
    (typeof xg === "number" ? xg * 15 : 0);

  return Math.max(0, Math.min(100, Math.round(score)));
}
