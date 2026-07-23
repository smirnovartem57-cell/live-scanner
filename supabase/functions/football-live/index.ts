import {
  normalizeApiFootballEvent,
  normalizeApiFootballMatch,
  normalizeApiFootballSnapshot,
  normalizeApiFootballTeamProfiles,
  type ApiFootballEvent,
  type ApiFootballFixture,
  type ApiFootballStatGroup
} from "../../../src/services/apiFootball/normalizeApiFootball.ts";
import {
  allowedDetailFixtureCount,
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_DAILY_RESERVE,
  DEFAULT_MAX_FIXTURES,
  MAX_FIXTURES_PER_REFRESH
} from "../../../src/services/apiFootball/quotaPolicy.ts";

type FootballLivePayload = {
  scope?: "live-snapshot";
  fixtureIds?: string[];
};

type LiveSnapshotResponse = {
  ok: boolean;
  provider: string;
  message: string;
  cached?: boolean;
  stale?: boolean;
  refreshing?: boolean;
  quota?: ApiQuota;
  data: ReturnType<typeof emptySnapshot>;
};

const cachedSnapshots = new Map<string, { expiresAt: number; response: LiveSnapshotResponse }>();

type ApiQuota = {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  minuteLimit: number | null;
  minuteRemaining: number | null;
  requestsUsed: number;
};

type CacheRow = {
  payload?: LiveSnapshotResponse;
  expires_at?: string;
  refresh_locked_until?: string;
  daily_limit?: number | null;
  daily_remaining?: number | null;
  minute_limit?: number | null;
  minute_remaining?: number | null;
  api_requests_used?: number;
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
  const preferredFixtureIds = normalizeFixtureIds(payload.fixtureIds);
  const activeCacheKey = buildCacheKey(preferredFixtureIds);

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
  const memoryCache = cachedSnapshots.get(activeCacheKey);
  if (memoryCache && memoryCache.expiresAt > now) {
    return json({ ...memoryCache.response, cached: true });
  }

  const apiBaseUrl = Deno.env.get("API_FOOTBALL_BASE_URL") || "https://v3.football.api-sports.io";
  const cacheTtlSeconds = parsePositiveInteger(
    Deno.env.get("API_FOOTBALL_CACHE_TTL_SECONDS"),
    DEFAULT_CACHE_TTL_SECONDS
  );
  const maxFixtures = clamp(
    parsePositiveInteger(Deno.env.get("API_FOOTBALL_MAX_FIXTURES"), DEFAULT_MAX_FIXTURES),
    1,
    MAX_FIXTURES_PER_REFRESH
  );
  const dailyReserve = parsePositiveInteger(
    Deno.env.get("API_FOOTBALL_DAILY_RESERVE"),
    DEFAULT_DAILY_RESERVE
  );
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const [persistentCache, latestQuotaCache] = supabaseUrl && serviceRoleKey
    ? await Promise.all([
      readPersistentCache(supabaseUrl, serviceRoleKey, activeCacheKey),
      readLatestQuotaCache(supabaseUrl, serviceRoleKey)
    ])
    : [null, null];

  if (persistentCache && isFresh(persistentCache.expires_at, now) && persistentCache.payload?.data) {
    const response = { ...persistentCache.payload, cached: true, stale: false };
    cachedSnapshots.set(activeCacheKey, { expiresAt: Date.parse(persistentCache.expires_at!), response });
    return json(response);
  }

  if (latestQuotaCache?.daily_remaining != null && latestQuotaCache.daily_remaining <= dailyReserve) {
    return json(staleResponse(
      persistentCache || latestQuotaCache,
      `API daily reserve reached (${latestQuotaCache.daily_remaining} requests remaining).`
    ));
  }

  if (supabaseUrl && serviceRoleKey) {
    const claimed = await claimPersistentRefresh(supabaseUrl, serviceRoleKey, activeCacheKey);
    if (!claimed) {
      const currentCache = persistentCache || await readPersistentCache(supabaseUrl, serviceRoleKey, activeCacheKey);
      return json(currentCache?.payload?.data
        ? {
          ...currentCache.payload,
          cached: true,
          stale: true,
          refreshing: true,
          message: "Another worker is refreshing API-FOOTBALL data."
        }
        : {
          ok: true,
          provider: "api-football-cache",
          cached: true,
          stale: true,
          refreshing: true,
          message: "Another worker is preparing the first API-FOOTBALL snapshot.",
          data: emptySnapshot()
        });
    }
  }

  const quota = emptyQuota();
  let response: LiveSnapshotResponse;

  try {
    const fixturesResponse = await apiFootball<{ response?: ApiFootballFixture[] }>(
      apiBaseUrl,
      apiKey,
      preferredFixtureIds.length
        ? `/fixtures?ids=${preferredFixtureIds.join("-")}`
        : "/fixtures?live=all",
      quota
    );
    const allFixtures = orderFixtures(fixturesResponse.response || [], preferredFixtureIds);
    const allowedFixtures = allowedDetailFixtureCount(quota.dailyRemaining, maxFixtures, dailyReserve);
    const detailFixtures = allFixtures.slice(0, allowedFixtures);
    const [statistics, events] = await Promise.all([
      getStatistics(apiBaseUrl, apiKey, detailFixtures, quota),
      getEvents(apiBaseUrl, apiKey, detailFixtures, quota)
    ]);

    response = {
      ok: true,
      provider: "api-football",
      message: `Loaded ${allFixtures.length} live matches; detailed statistics for ${detailFixtures.length}.`,
      cached: false,
      stale: false,
      refreshing: false,
      quota: { ...quota },
      data: {
        matches: allFixtures.map(normalizeApiFootballMatch),
        snapshots: detailFixtures.map((fixture) => normalizeApiFootballSnapshot(fixture, statistics.get(String(fixture.fixture.id)) || [])),
        events: Object.fromEntries(detailFixtures.map((fixture) => {
          const fixtureId = String(fixture.fixture.id);
          return [fixtureId, (events.get(fixtureId) || []).map((event) => normalizeApiFootballEvent(event, fixture))];
        })),
        signals: [],
        history: [],
        teamProfiles: allFixtures.flatMap(normalizeApiFootballTeamProfiles),
        feedbackItems: []
      }
    };
  } catch (error) {
    if (persistentCache?.payload?.data) {
      return json(staleResponse(
        persistentCache,
        `API refresh failed; serving the last snapshot. ${error instanceof Error ? error.message : ""}`.trim()
      ));
    }
    throw error;
  }

  cachedSnapshots.set(activeCacheKey, {
    expiresAt: now + cacheTtlSeconds * 1000,
    response
  });

  if (supabaseUrl && serviceRoleKey) {
    await writePersistentCache(supabaseUrl, serviceRoleKey, activeCacheKey, response, cacheTtlSeconds, quota);
  }

  return json(response);
});

function hasAccess(request: Request) {
  const expectedToken = Deno.env.get("FOOTBALL_DATA_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expectedToken) && request.headers.get("x-live-scanner-key") === expectedToken;
}

async function getStatistics(apiBaseUrl: string, apiKey: string, fixtures: ApiFootballFixture[], quota: ApiQuota) {
  const entries = await Promise.all(fixtures.map(async (fixture) => {
    const fixtureId = String(fixture.fixture.id);
    try {
      const response = await apiFootball<{ response?: ApiFootballStatGroup[] }>(
        apiBaseUrl,
        apiKey,
        `/fixtures/statistics?fixture=${fixtureId}`,
        quota
      );
      return [fixtureId, response.response || []] as const;
    } catch (error) {
      console.warn(`Failed to load statistics for fixture ${fixtureId}`, error);
      return [fixtureId, []] as const;
    }
  }));

  return new Map(entries);
}

async function getEvents(apiBaseUrl: string, apiKey: string, fixtures: ApiFootballFixture[], quota: ApiQuota) {
  const entries = await Promise.all(fixtures.map(async (fixture) => {
    const fixtureId = String(fixture.fixture.id);
    try {
      const response = await apiFootball<{ response?: ApiFootballEvent[] }>(
        apiBaseUrl,
        apiKey,
        `/fixtures/events?fixture=${fixtureId}`,
        quota
      );
      return [fixtureId, response.response || []] as const;
    } catch (error) {
      console.warn(`Failed to load events for fixture ${fixtureId}`, error);
      return [fixtureId, []] as const;
    }
  }));

  return new Map(entries);
}

async function apiFootball<T>(apiBaseUrl: string, apiKey: string, path: string, quota: ApiQuota): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    headers: {
      "x-apisports-key": apiKey,
      accept: "application/json"
    }
  });

  updateQuota(quota, response.headers);

  if (!response.ok) {
    throw new Error(`API-FOOTBALL request failed: ${await response.text()}`);
  }

  return await response.json() as T;
}

function emptyQuota(): ApiQuota {
  return {
    dailyLimit: null,
    dailyRemaining: null,
    minuteLimit: null,
    minuteRemaining: null,
    requestsUsed: 0
  };
}

function updateQuota(quota: ApiQuota, headers: Headers) {
  quota.requestsUsed += 1;
  quota.dailyLimit = headerNumber(headers, "x-ratelimit-requests-limit") ?? quota.dailyLimit;
  quota.dailyRemaining = minNullable(
    quota.dailyRemaining,
    headerNumber(headers, "x-ratelimit-requests-remaining")
  );
  quota.minuteLimit = headerNumber(headers, "x-ratelimit-limit") ?? quota.minuteLimit;
  quota.minuteRemaining = minNullable(
    quota.minuteRemaining,
    headerNumber(headers, "x-ratelimit-remaining")
  );
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

async function readPersistentCache(supabaseUrl: string, key: string, requestedCacheKey: string): Promise<CacheRow | null> {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/football_live_cache?cache_key=eq.${encodeURIComponent(requestedCacheKey)}&select=*&limit=1`,
      { headers: restHeaders(key) }
    );
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json() as CacheRow[];
    return rows[0] || null;
  } catch (error) {
    console.warn("Persistent football cache is unavailable", error);
    return null;
  }
}

async function readLatestQuotaCache(supabaseUrl: string, key: string): Promise<CacheRow | null> {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/football_live_cache?select=*&daily_remaining=not.is.null&order=updated_at.desc&limit=1`,
      { headers: restHeaders(key) }
    );
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json() as CacheRow[];
    return rows[0] || null;
  } catch (error) {
    console.warn("Persistent football quota telemetry is unavailable", error);
    return null;
  }
}

async function claimPersistentRefresh(supabaseUrl: string, key: string, requestedCacheKey: string) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_football_live_refresh`, {
      method: "POST",
      headers: restHeaders(key),
      body: JSON.stringify({ requested_cache_key: requestedCacheKey, lock_seconds: 120 })
    });
    if (!response.ok) throw new Error(await response.text());
    return Boolean(await response.json());
  } catch (error) {
    console.warn("Persistent football refresh lock is unavailable", error);
    return true;
  }
}

async function writePersistentCache(
  supabaseUrl: string,
  key: string,
  requestedCacheKey: string,
  responseBody: LiveSnapshotResponse,
  ttlSeconds: number,
  quota: ApiQuota
) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const response = await fetch(
      `${supabaseUrl}/rest/v1/football_live_cache?on_conflict=cache_key`,
      {
        method: "POST",
        headers: {
          ...restHeaders(key),
          prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          cache_key: requestedCacheKey,
          payload: responseBody,
          provider: responseBody.provider,
          message: responseBody.message,
          api_requests_used: quota.requestsUsed,
          daily_limit: quota.dailyLimit,
          daily_remaining: quota.dailyRemaining,
          minute_limit: quota.minuteLimit,
          minute_remaining: quota.minuteRemaining,
          expires_at: expiresAt,
          refresh_locked_until: new Date(0).toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );
    if (!response.ok) throw new Error(await response.text());
  } catch (error) {
    console.warn("Failed to persist football cache", error);
  }
}

function staleResponse(cache: CacheRow, message: string): LiveSnapshotResponse {
  return {
    ...(cache.payload || {
      ok: true,
      provider: "api-football-cache",
      message,
      data: emptySnapshot()
    }),
    cached: true,
    stale: true,
    refreshing: false,
    message,
    quota: {
      dailyLimit: cache.daily_limit ?? null,
      dailyRemaining: cache.daily_remaining ?? null,
      minuteLimit: cache.minute_limit ?? null,
      minuteRemaining: cache.minute_remaining ?? null,
      requestsUsed: cache.api_requests_used || 0
    }
  };
}

function isFresh(expiresAt: string | undefined, now: number) {
  return Boolean(expiresAt && Date.parse(expiresAt) > now);
}

function normalizeFixtureIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => String(item).trim())
    .filter((item) => /^\d+$/.test(item)))]
    .slice(0, 4);
}

function buildCacheKey(fixtureIds: string[]) {
  const scope = fixtureIds.length ? [...fixtureIds].sort().join("-") : "all";
  return `live-snapshot-v2:${scope}`;
}

function orderFixtures(fixtures: ApiFootballFixture[], preferredFixtureIds: string[]) {
  if (!preferredFixtureIds.length) return fixtures;
  const priority = new Map(preferredFixtureIds.map((id, index) => [id, index]));
  return [...fixtures].sort((left, right) => {
    const leftPriority = priority.get(String(left.fixture.id)) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(String(right.fixture.id)) ?? Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority;
  });
}

function restHeaders(key: string) {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json"
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
