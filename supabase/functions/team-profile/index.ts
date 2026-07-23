type Payload = {
  teamId?: string;
  leagueId?: number;
  season?: number;
};

type ApiTeam = { id: number; name: string; logo?: string };
type ApiFixture = {
  fixture: { id: number; date?: string; status?: { short?: string } };
  league?: { id?: number; name?: string; country?: string; season?: number };
  teams: { home: ApiTeam; away: ApiTeam };
  goals?: { home?: number | null; away?: number | null };
};
type TeamStatistics = {
  team?: ApiTeam;
  league?: { id?: number; name?: string; country?: string; season?: number };
  fixtures?: {
    played?: { total?: number };
    wins?: { total?: number };
  };
  goals?: {
    for?: { average?: { total?: string | number | null } };
    against?: { average?: { total?: string | number | null } };
  };
};
type ApiQuota = {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  requestsUsed: number;
};
type CacheRow = {
  payload?: Record<string, unknown>;
  expires_at?: string;
};

const memoryCache = new Map<string, { expiresAt: number; response: Record<string, unknown> }>();
const DAY_SECONDS = 86400;
const DAILY_RESERVE = 5;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-live-scanner-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!hasAccess(request)) return json({ error: "Access denied" }, 403);

  try {
    const payload = await request.json() as Payload;
    const teamId = normalizeId(payload.teamId);
    if (!teamId) return json({ error: "Valid teamId is required" }, 400);
    const leagueId = normalizeNumber(payload.leagueId);
    const season = normalizeNumber(payload.season);
    const cacheKey = `team:${teamId}:league:${leagueId || "all"}:season:${season || "current"}`;
    const now = Date.now();
    const memory = memoryCache.get(cacheKey);
    if (memory && memory.expiresAt > now) return json({ ...memory.response, cached: true });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const persistent = supabaseUrl && serviceRoleKey
      ? await readCache(supabaseUrl, serviceRoleKey, cacheKey)
      : null;
    if (persistent?.payload && persistent.expires_at && Date.parse(persistent.expires_at) > now) {
      const response = { ...persistent.payload, cached: true };
      memoryCache.set(cacheKey, { expiresAt: Date.parse(persistent.expires_at), response });
      return json(response);
    }

    const apiKey = Deno.env.get("API_FOOTBALL_KEY")?.trim();
    if (!apiKey) return json({ error: "API_FOOTBALL_KEY is not configured" }, 500);
    if (supabaseUrl && serviceRoleKey) {
      const remaining = await readDailyRemaining(supabaseUrl, serviceRoleKey);
      const requiredRequests = leagueId && season ? 2 : 1;
      if (remaining != null && remaining - requiredRequests < DAILY_RESERVE) {
        return json(persistent?.payload
          ? { ...persistent.payload, ok: true, cached: true, stale: true, message: "API daily reserve protected." }
          : emptyResponse(teamId, "API daily reserve protected."));
      }
      const claimed = await claimRefresh(supabaseUrl, serviceRoleKey, cacheKey, teamId);
      if (claimed === null) {
        return json(emptyResponse(teamId, "Team profile cache migration 007 is required."));
      }
      if (!claimed) {
        return json(persistent?.payload
          ? { ...persistent.payload, cached: true, stale: true, refreshing: true }
          : emptyResponse(teamId, "Another worker is preparing this team profile."));
      }
    }

    const apiBaseUrl = Deno.env.get("API_FOOTBALL_BASE_URL") || "https://v3.football.api-sports.io";
    const quota = emptyQuota();
    const fixturesPayload = await apiFootball<{ response?: ApiFixture[] }>(
      apiBaseUrl,
      apiKey,
      `/fixtures?team=${teamId}&last=5`,
      quota
    );
    const fixtures = fixturesPayload.response || [];
    const statistics = leagueId && season
      ? (await apiFootball<{ response?: TeamStatistics }>(
        apiBaseUrl,
        apiKey,
        `/teams/statistics?league=${leagueId}&season=${season}&team=${teamId}`,
        quota
      )).response
      : undefined;
    const response = buildResponse(teamId, fixtures, statistics, quota);
    memoryCache.set(cacheKey, { expiresAt: now + DAY_SECONDS * 1000, response });

    if (supabaseUrl && serviceRoleKey) {
      await Promise.all([
        writeCache(supabaseUrl, serviceRoleKey, cacheKey, teamId, response, quota),
        writeQuotaTelemetry(supabaseUrl, serviceRoleKey, quota)
      ]);
    }
    return json(response);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Team profile failed" }, 500);
  }
});

function buildResponse(teamId: string, fixtures: ApiFixture[], statistics: TeamStatistics | undefined, quota: ApiQuota) {
  const team = statistics?.team || findTeam(fixtures, teamId);
  const league = statistics?.league || fixtures[0]?.league;
  const played = statistics?.fixtures?.played?.total;
  const wins = statistics?.fixtures?.wins?.total;
  return {
    ok: true,
    provider: "api-football",
    cached: false,
    stale: false,
    message: `Loaded team profile with ${fixtures.length} recent matches.`,
    quota,
    profile: {
      id: teamId,
      name: team?.name || `Team ${teamId}`,
      logo: team?.logo,
      country: league?.country,
      league: league?.name,
      recentMatches: fixtures.map((fixture) => toRecentMatch(fixture, teamId)),
      averages: {
        matchesCount: played,
        goalsFor: parseMetric(statistics?.goals?.for?.average?.total),
        goalsAgainst: parseMetric(statistics?.goals?.against?.average?.total),
        winRate: typeof played === "number" && played > 0 && typeof wins === "number"
          ? Math.round((wins / played) * 100)
          : undefined
      },
      characteristicPatterns: [],
      updatedAt: new Date().toISOString()
    }
  };
}

function toRecentMatch(fixture: ApiFixture, teamId: string) {
  const isHome = String(fixture.teams.home.id) === teamId;
  const opponent = isHome ? fixture.teams.away : fixture.teams.home;
  const teamGoals = Number(isHome ? fixture.goals?.home : fixture.goals?.away) || 0;
  const opponentGoals = Number(isHome ? fixture.goals?.away : fixture.goals?.home) || 0;
  return {
    date: fixture.fixture.date || new Date(0).toISOString(),
    opponent: opponent.name,
    score: isHome ? `${teamGoals}:${opponentGoals}` : `${opponentGoals}:${teamGoals}`,
    tournament: fixture.league?.name || "Unknown tournament",
    status: teamGoals > opponentGoals ? "win" : teamGoals < opponentGoals ? "loss" : "draw"
  };
}

function findTeam(fixtures: ApiFixture[], teamId: string) {
  for (const fixture of fixtures) {
    if (String(fixture.teams.home.id) === teamId) return fixture.teams.home;
    if (String(fixture.teams.away.id) === teamId) return fixture.teams.away;
  }
  return undefined;
}

async function apiFootball<T>(baseUrl: string, key: string, path: string, quota: ApiQuota): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "x-apisports-key": key, accept: "application/json" }
  });
  quota.requestsUsed += 1;
  quota.dailyLimit = headerNumber(response.headers, "x-ratelimit-requests-limit") ?? quota.dailyLimit;
  quota.dailyRemaining = minNullable(
    quota.dailyRemaining,
    headerNumber(response.headers, "x-ratelimit-requests-remaining")
  );
  if (!response.ok) throw new Error(`API-FOOTBALL request failed: ${await response.text()}`);
  return await response.json() as T;
}

async function readCache(url: string, key: string, cacheKey: string): Promise<CacheRow | null> {
  try {
    const response = await fetch(
      `${url}/rest/v1/team_profile_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=*&limit=1`,
      { headers: restHeaders(key) }
    );
    if (!response.ok) throw new Error(await response.text());
    return (await response.json() as CacheRow[])[0] || null;
  } catch (error) {
    console.warn("Team profile cache is unavailable", error);
    return null;
  }
}

async function readDailyRemaining(url: string, key: string) {
  try {
    const response = await fetch(
      `${url}/rest/v1/football_live_cache?select=daily_remaining&daily_remaining=not.is.null&order=updated_at.desc&limit=1`,
      { headers: restHeaders(key) }
    );
    if (!response.ok) throw new Error(await response.text());
    const row = (await response.json() as Array<{ daily_remaining?: number }>)[0];
    return typeof row?.daily_remaining === "number" ? row.daily_remaining : null;
  } catch {
    return null;
  }
}

async function claimRefresh(url: string, key: string, cacheKey: string, teamId: string) {
  try {
    const response = await fetch(`${url}/rest/v1/rpc/claim_team_profile_refresh`, {
      method: "POST",
      headers: restHeaders(key),
      body: JSON.stringify({
        requested_cache_key: cacheKey,
        requested_team_id: teamId,
        lock_seconds: 120
      })
    });
    if (!response.ok) throw new Error(await response.text());
    return Boolean(await response.json());
  } catch {
    return null;
  }
}

async function writeCache(
  url: string,
  key: string,
  cacheKey: string,
  teamId: string,
  payload: Record<string, unknown>,
  quota: ApiQuota
) {
  try {
    const response = await fetch(`${url}/rest/v1/team_profile_cache?on_conflict=cache_key`, {
      method: "POST",
      headers: { ...restHeaders(key), prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        cache_key: cacheKey,
        team_id: teamId,
        payload,
        expires_at: new Date(Date.now() + DAY_SECONDS * 1000).toISOString(),
        refresh_locked_until: new Date(0).toISOString(),
        daily_limit: quota.dailyLimit,
        daily_remaining: quota.dailyRemaining,
        api_requests_used: quota.requestsUsed,
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) throw new Error(await response.text());
  } catch (error) {
    console.warn("Failed to persist team profile cache", error);
  }
}

async function writeQuotaTelemetry(url: string, key: string, quota: ApiQuota) {
  if (quota.dailyRemaining == null) return;
  try {
    const latestResponse = await fetch(
      `${url}/rest/v1/football_live_cache?select=cache_key&order=updated_at.desc&limit=1`,
      { headers: restHeaders(key) }
    );
    if (!latestResponse.ok) return;
    const cacheKey = (await latestResponse.json() as Array<{ cache_key?: string }>)[0]?.cache_key;
    if (!cacheKey) return;
    await fetch(`${url}/rest/v1/football_live_cache?cache_key=eq.${encodeURIComponent(cacheKey)}`, {
      method: "PATCH",
      headers: restHeaders(key),
      body: JSON.stringify({
        daily_limit: quota.dailyLimit,
        daily_remaining: quota.dailyRemaining,
        updated_at: new Date().toISOString()
      })
    });
  } catch {
    // Quota telemetry is best effort.
  }
}

function emptyResponse(teamId: string, message: string) {
  return {
    ok: true,
    provider: "api-football-cache",
    cached: true,
    stale: true,
    message,
    teamId,
    profile: null
  };
}

function hasAccess(request: Request) {
  const expected = Deno.env.get("FOOTBALL_DATA_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expected) && request.headers.get("x-live-scanner-key") === expected;
}

function normalizeId(value: unknown) {
  const text = String(value || "").trim();
  return /^\d+$/.test(text) ? text : "";
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function parseMetric(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : undefined;
}

function emptyQuota(): ApiQuota {
  return { dailyLimit: null, dailyRemaining: null, requestsUsed: 0 };
}

function headerNumber(headers: Headers, name: string) {
  const value = headers.get(name);
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function minNullable(current: number | null, next: number | null) {
  if (next == null) return current;
  return current == null ? next : Math.min(current, next);
}

function restHeaders(key: string) {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json"
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });
}
