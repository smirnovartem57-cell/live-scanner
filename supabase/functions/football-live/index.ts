import {
  normalizeApiFootballEvent,
  normalizeApiFootballMatch,
  normalizeApiFootballSnapshot,
  normalizeApiFootballTeamProfiles,
  type ApiFootballEvent,
  type ApiFootballFixture,
  type ApiFootballStatGroup
} from "../../../src/services/apiFootball/normalizeApiFootball.ts";

type FootballLivePayload = {
  scope?: "live-snapshot";
};

type LiveSnapshotResponse = {
  ok: boolean;
  provider: string;
  message: string;
  cached?: boolean;
  data: ReturnType<typeof emptySnapshot>;
};

let cachedSnapshot: { expiresAt: number; response: LiveSnapshotResponse } | null = null;

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

  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return json({ ...cachedSnapshot.response, cached: true });
  }

  const apiBaseUrl = Deno.env.get("API_FOOTBALL_BASE_URL") || "https://v3.football.api-sports.io";
  const cacheTtlSeconds = parsePositiveInteger(Deno.env.get("API_FOOTBALL_CACHE_TTL_SECONDS"), 45);
  const maxFixtures = parsePositiveInteger(Deno.env.get("API_FOOTBALL_MAX_FIXTURES"), 30);
  const fixturesResponse = await apiFootball<{ response?: ApiFootballFixture[] }>(apiBaseUrl, apiKey, "/fixtures?live=all");
  const allFixtures = fixturesResponse.response || [];
  const fixtures = allFixtures.slice(0, maxFixtures);
  const [statistics, events] = await Promise.all([
    getStatistics(apiBaseUrl, apiKey, fixtures),
    getEvents(apiBaseUrl, apiKey, fixtures)
  ]);

  const response: LiveSnapshotResponse = {
    ok: true,
    provider: "api-football",
    message: `Loaded ${fixtures.length} of ${allFixtures.length} live matches.`,
    cached: false,
    data: {
      matches: fixtures.map(normalizeApiFootballMatch),
      snapshots: fixtures.map((fixture) => normalizeApiFootballSnapshot(fixture, statistics.get(String(fixture.fixture.id)) || [])),
      events: Object.fromEntries(fixtures.map((fixture) => {
        const fixtureId = String(fixture.fixture.id);
        return [fixtureId, (events.get(fixtureId) || []).map((event) => normalizeApiFootballEvent(event, fixture))];
      })),
      signals: [],
      history: [],
      teamProfiles: fixtures.flatMap(normalizeApiFootballTeamProfiles),
      feedbackItems: []
    }
  };

  cachedSnapshot = {
    expiresAt: now + cacheTtlSeconds * 1000,
    response
  };

  return json(response);
});

function hasAccess(request: Request) {
  const expectedToken = Deno.env.get("FOOTBALL_DATA_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expectedToken) && request.headers.get("x-live-scanner-key") === expectedToken;
}

async function getStatistics(apiBaseUrl: string, apiKey: string, fixtures: ApiFootballFixture[]) {
  const entries = await Promise.all(fixtures.map(async (fixture) => {
    const fixtureId = String(fixture.fixture.id);
    try {
      const response = await apiFootball<{ response?: ApiFootballStatGroup[] }>(
        apiBaseUrl,
        apiKey,
        `/fixtures/statistics?fixture=${fixtureId}`
      );
      return [fixtureId, response.response || []] as const;
    } catch (error) {
      console.warn(`Failed to load statistics for fixture ${fixtureId}`, error);
      return [fixtureId, []] as const;
    }
  }));

  return new Map(entries);
}

async function getEvents(apiBaseUrl: string, apiKey: string, fixtures: ApiFootballFixture[]) {
  const entries = await Promise.all(fixtures.map(async (fixture) => {
    const fixtureId = String(fixture.fixture.id);
    try {
      const response = await apiFootball<{ response?: ApiFootballEvent[] }>(
        apiBaseUrl,
        apiKey,
        `/fixtures/events?fixture=${fixtureId}`
      );
      return [fixtureId, response.response || []] as const;
    } catch (error) {
      console.warn(`Failed to load events for fixture ${fixtureId}`, error);
      return [fixtureId, []] as const;
    }
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

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
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
