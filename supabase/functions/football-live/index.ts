type FootballLivePayload = {
  scope?: "live-snapshot";
};

type ApiFootballFixture = {
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

type ApiFootballTeam = {
  id: number;
  name: string;
  logo?: string;
};

type ApiFootballStatGroup = {
  team: ApiFootballTeam;
  statistics: Array<{
    type: string;
    value: number | string | null;
  }>;
};

type ApiFootballEvent = {
  time?: {
    elapsed?: number | null;
  };
  team?: ApiFootballTeam;
  type?: string;
  detail?: string;
};

type TeamSide = "home" | "away";
type MatchStatus = "live" | "halftime" | "finished" | "scheduled";
type MatchEventType = "goal" | "card" | "substitution" | "period";

type TeamStats = {
  attacks?: number;
  dangerousAttacks?: number;
  shotsTotal?: number;
  shotsOnTarget?: number;
  corners?: number;
  possession?: number;
  xg?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-live-scanner-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!hasAccess(request)) {
    return json({ error: "Access denied" }, 403);
  }

  const payload = await request.json() as FootballLivePayload;

  if (payload.scope !== "live-snapshot") {
    return json({ error: "Unsupported scope" }, 400);
  }

  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!apiKey) {
    return json({
      ok: true,
      provider: "not_configured",
      message: "API_FOOTBALL_KEY is not configured.",
      data: emptySnapshot()
    });
  }

  const apiBaseUrl = Deno.env.get("API_FOOTBALL_BASE_URL") || "https://v3.football.api-sports.io";
  const fixturesResponse = await apiFootball<{ response?: ApiFootballFixture[] }>(apiBaseUrl, apiKey, "/fixtures?live=all");
  const fixtures = fixturesResponse.response || [];
  const [statistics, events] = await Promise.all([
    getStatistics(apiBaseUrl, apiKey, fixtures),
    getEvents(apiBaseUrl, apiKey, fixtures)
  ]);

  return json({
    ok: true,
    provider: "api-football",
    message: `Loaded ${fixtures.length} live matches.`,
    data: {
      matches: fixtures.map(toMatch),
      snapshots: fixtures.map((fixture) => toSnapshot(fixture, statistics.get(String(fixture.fixture.id)) || [])),
      events: Object.fromEntries(fixtures.map((fixture) => {
        const fixtureId = String(fixture.fixture.id);
        return [fixtureId, (events.get(fixtureId) || []).map((event) => toMatchEvent(event, fixture))];
      })),
      signals: [],
      history: [],
      teamProfiles: fixtures.flatMap(toTeamProfiles),
      feedbackItems: []
    }
  });
});

function hasAccess(request: Request) {
  const expectedToken = Deno.env.get("FOOTBALL_DATA_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expectedToken) && request.headers.get("x-live-scanner-key") === expectedToken;
}

async function getStatistics(apiBaseUrl: string, apiKey: string, fixtures: ApiFootballFixture[]) {
  const entries = await Promise.all(fixtures.map(async (fixture) => {
    const fixtureId = String(fixture.fixture.id);
    const response = await apiFootball<{ response?: ApiFootballStatGroup[] }>(
      apiBaseUrl,
      apiKey,
      `/fixtures/statistics?fixture=${fixtureId}`
    );
    return [fixtureId, response.response || []] as const;
  }));

  return new Map(entries);
}

async function getEvents(apiBaseUrl: string, apiKey: string, fixtures: ApiFootballFixture[]) {
  const entries = await Promise.all(fixtures.map(async (fixture) => {
    const fixtureId = String(fixture.fixture.id);
    const response = await apiFootball<{ response?: ApiFootballEvent[] }>(
      apiBaseUrl,
      apiKey,
      `/fixtures/events?fixture=${fixtureId}`
    );
    return [fixtureId, response.response || []] as const;
  }));

  return new Map(entries);
}

async function apiFootball<T>(apiBaseUrl: string, apiKey: string, path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    headers: {
      "x-apisports-key": apiKey,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API-FOOTBALL request failed: ${await response.text()}`);
  }

  return await response.json() as T;
}

function toMatch(fixture: ApiFootballFixture) {
  return {
    id: String(fixture.fixture.id),
    league: fixture.league?.name || "Unknown league",
    country: fixture.league?.country,
    homeTeamId: String(fixture.teams.home.id),
    awayTeamId: String(fixture.teams.away.id),
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    minute: fixture.fixture.status?.elapsed || 0,
    status: toMatchStatus(fixture.fixture.status?.short),
    scoreHome: fixture.goals?.home || 0,
    scoreAway: fixture.goals?.away || 0,
    isTopLeague: false,
    updatedAt: new Date().toISOString()
  };
}

function toSnapshot(fixture: ApiFootballFixture, groups: ApiFootballStatGroup[]) {
  return {
    id: `api-football-${fixture.fixture.id}-${fixture.fixture.status?.elapsed || 0}`,
    matchId: String(fixture.fixture.id),
    minute: fixture.fixture.status?.elapsed || 0,
    createdAt: new Date().toISOString(),
    home: toTeamStats(groups.find((group) => group.team.id === fixture.teams.home.id)),
    away: toTeamStats(groups.find((group) => group.team.id === fixture.teams.away.id))
  };
}

function toTeamStats(group?: ApiFootballStatGroup): TeamStats {
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

function toMatchEvent(event: ApiFootballEvent, fixture: ApiFootballFixture) {
  return {
    id: [
      "api-football",
      fixture.fixture.id,
      event.time?.elapsed || 0,
      event.type || "event",
      event.detail || "",
      event.team?.id || "team"
    ].join("-"),
    type: toEventType(event.type),
    minute: event.time?.elapsed || 0,
    teamSide: getTeamSide(event.team?.id, fixture),
    teamId: event.team?.id ? String(event.team.id) : undefined
  };
}

function toTeamProfiles(fixture: ApiFootballFixture) {
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

function toMatchStatus(short?: string | null): MatchStatus {
  if (short === "HT") return "halftime";
  if (["FT", "AET", "PEN"].includes(short || "")) return "finished";
  if (["NS", "TBD", "PST"].includes(short || "")) return "scheduled";
  return "live";
}

function toEventType(type?: string): MatchEventType {
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

function emptySnapshot() {
  return {
    matches: [],
    snapshots: [],
    events: {},
    signals: [],
    history: [],
    teamProfiles: [],
    feedbackItems: []
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json"
    }
  });
}
