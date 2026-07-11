import type { Match, MatchEvent, MatchStatsSnapshot, MatchStatus, TeamSide, TeamStats } from "../../types/football";
import type { TeamProfile } from "../../types/football";

export type ApiFootballFixture = {
  fixture: {
    id: number;
    date?: string;
    status?: {
      elapsed?: number | null;
      short?: string | null;
    };
  };
  league?: {
    name?: string;
    country?: string;
  };
  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
};

export type ApiFootballTeam = {
  id: number;
  name: string;
  logo?: string;
};

export type ApiFootballStatGroup = {
  team: ApiFootballTeam;
  statistics: Array<{
    type: string;
    value: number | string | null;
  }>;
};

export type ApiFootballEvent = {
  time?: {
    elapsed?: number | null;
  };
  team?: ApiFootballTeam;
  type?: string;
  detail?: string;
};

export function normalizeApiFootballMatch(fixture: ApiFootballFixture): Match {
  return {
    id: String(fixture.fixture.id),
    league: fixture.league?.name || "Unknown league",
    country: fixture.league?.country,
    homeTeamId: String(fixture.teams.home.id),
    awayTeamId: String(fixture.teams.away.id),
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    minute: fixture.fixture.status?.elapsed || 0,
    status: normalizeApiFootballMatchStatus(fixture.fixture.status?.short),
    scoreHome: fixture.goals?.home || 0,
    scoreAway: fixture.goals?.away || 0,
    isTopLeague: false,
    updatedAt: new Date().toISOString()
  };
}

export function normalizeApiFootballSnapshot(fixture: ApiFootballFixture, groups: ApiFootballStatGroup[]): MatchStatsSnapshot {
  return {
    id: `api-football-${fixture.fixture.id}-${fixture.fixture.status?.elapsed || 0}`,
    matchId: String(fixture.fixture.id),
    minute: fixture.fixture.status?.elapsed || 0,
    createdAt: new Date().toISOString(),
    home: normalizeApiFootballTeamStats(groups.find((group) => group.team.id === fixture.teams.home.id)),
    away: normalizeApiFootballTeamStats(groups.find((group) => group.team.id === fixture.teams.away.id))
  };
}

export function normalizeApiFootballTeamStats(group?: ApiFootballStatGroup): TeamStats {
  const values = new Map((group?.statistics || []).map((stat) => [normalizeStatName(stat.type), stat.value]));

  return {
    attacks: numberStat(values, "attacks"),
    dangerousAttacks: numberStat(values, "dangerous attacks"),
    shotsTotal: numberStat(values, "total shots"),
    shotsOnTarget: numberStat(values, "shots on goal"),
    corners: numberStat(values, "corner kicks"),
    possession: numberStat(values, "ball possession"),
    xg: numberStat(values, "expected goals") || numberStat(values, "expected_goals")
  };
}

export function normalizeApiFootballEvent(event: ApiFootballEvent, fixture: ApiFootballFixture): MatchEvent {
  return {
    id: [
      "api-football",
      fixture.fixture.id,
      event.time?.elapsed || 0,
      event.type || "event",
      event.detail || "",
      event.team?.id || "team"
    ].join("-"),
    type: normalizeApiFootballEventType(event.type),
    minute: event.time?.elapsed || 0,
    teamSide: getTeamSide(event.team?.id, fixture),
    teamId: event.team?.id ? String(event.team.id) : undefined
  };
}

export function normalizeApiFootballTeamProfiles(fixture: ApiFootballFixture): TeamProfile[] {
  return [fixture.teams.home, fixture.teams.away].map((team) => ({
    id: String(team.id),
    name: team.name,
    country: fixture.league?.country,
    league: fixture.league?.name,
    logo: team.logo,
    recentMatches: [],
    characteristicPatterns: [],
    updatedAt: new Date().toISOString()
  }));
}

export function normalizeApiFootballMatchStatus(short?: string | null): MatchStatus {
  if (short === "HT") return "halftime";
  if (["FT", "AET", "PEN"].includes(short || "")) return "finished";
  if (["NS", "TBD", "PST"].includes(short || "")) return "scheduled";
  return "live";
}

function normalizeApiFootballEventType(type?: string): MatchEvent["type"] {
  const clean = String(type || "").toLowerCase();
  if (clean.includes("goal")) return "goal";
  if (clean.includes("card")) return "card";
  if (clean.includes("subst")) return "substitution";
  return "period";
}

function getTeamSide(teamId: number | undefined, fixture: ApiFootballFixture): TeamSide | undefined {
  if (!teamId) return undefined;
  if (teamId === fixture.teams.home.id) return "home";
  if (teamId === fixture.teams.away.id) return "away";
  return undefined;
}

function numberStat(values: Map<string, number | string | null>, key: string) {
  return parseNumber(values.get(key));
}

function normalizeStatName(value: string) {
  return value.trim().toLowerCase();
}

function parseNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = Number(String(value).replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
