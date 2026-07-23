export const FREE_PLAN_DAILY_REQUESTS = 100;
export const DEFAULT_CACHE_TTL_SECONDS = 2700;
export const DEFAULT_DAILY_RESERVE = 5;
export const DEFAULT_MAX_FIXTURES = 1;
export const MAX_FIXTURES_PER_REFRESH = 4;

export function providerRequestsForFixtureCount(fixtureCount: number): number {
  return 1 + Math.max(0, Math.floor(fixtureCount)) * 2;
}

export function allowedDetailFixtureCount(
  dailyRemainingAfterFixtureList: number | null,
  configuredMaximum: number,
  dailyReserve: number
): number {
  const maximum = Math.max(0, Math.min(MAX_FIXTURES_PER_REFRESH, Math.floor(configuredMaximum)));
  if (dailyRemainingAfterFixtureList == null) return maximum;
  const detailBudget = Math.max(0, Math.floor(dailyRemainingAfterFixtureList) - Math.max(0, dailyReserve));
  return Math.min(maximum, Math.floor(detailBudget / 2));
}
