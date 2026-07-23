type RestResult = {
  ok: boolean;
  status: number;
  data: Array<Record<string, unknown>>;
  error?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-live-scanner-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!hasAccess(request)) return json({ error: "Access denied" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase server connection is unavailable" }, 500);
  }

  const [runs, cache, deliveries] = await Promise.all([
    readRows(
      supabaseUrl,
      serviceRoleKey,
      "journal_ingestion_runs?select=provider,status,matches_seen,signals_created,message,started_at,finished_at&order=started_at.desc&limit=1"
    ),
    readRows(
      supabaseUrl,
      serviceRoleKey,
      "football_live_cache?select=cache_key,provider,daily_limit,daily_remaining,minute_limit,minute_remaining,expires_at,updated_at&order=updated_at.desc&limit=1"
    ),
    readRows(
      supabaseUrl,
      serviceRoleKey,
      "telegram_signal_deliveries?select=status,attempt_count,last_error,sent_at,updated_at&order=updated_at.desc&limit=50"
    )
  ]);

  const missingSecrets = [
    ["API_FOOTBALL_KEY", Deno.env.get("API_FOOTBALL_KEY")],
    ["TELEGRAM_BOT_TOKEN", Deno.env.get("TELEGRAM_BOT_TOKEN")],
    ["TELEGRAM_CHANNEL", Deno.env.get("TELEGRAM_CHANNEL")],
    ["JOURNAL_ACCESS_TOKEN", Deno.env.get("JOURNAL_ACCESS_TOKEN")]
  ].filter(([, value]) => !value).map(([name]) => name);

  const latestRun = runs.data[0] || null;
  const latestCache = cache.data[0] || null;
  const migrationChecks = {
    journal: runs.ok,
    sharedCache: cache.ok,
    telegramDedupe: deliveries.ok
  };
  const degraded = missingSecrets.length > 0 ||
    Object.values(migrationChecks).some((ready) => !ready) ||
    latestRun?.status === "failed";

  return json({
    ok: !degraded,
    status: degraded ? "degraded" : "healthy",
    checkedAt: new Date().toISOString(),
    environment: {
      ready: missingSecrets.length === 0,
      missingSecrets
    },
    migrations: migrationChecks,
    latestScan: latestRun,
    cache: latestCache,
    telegram: summarizeDeliveries(deliveries.data),
    unavailable: {
      journal: runs.ok ? null : compactError(runs),
      sharedCache: cache.ok ? null : compactError(cache),
      telegramDedupe: deliveries.ok ? null : compactError(deliveries)
    }
  });
});

function hasAccess(request: Request) {
  const expected = Deno.env.get("SYSTEM_HEALTH_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expected) && request.headers.get("x-live-scanner-key") === expected;
}

async function readRows(url: string, key: string, path: string): Promise<RestResult> {
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`
      }
    });
    const body = await response.text();
    if (!response.ok) return { ok: false, status: response.status, data: [], error: body };
    return {
      ok: true,
      status: response.status,
      data: JSON.parse(body) as Array<Record<string, unknown>>
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: [],
      error: error instanceof Error ? error.message : "Request failed"
    };
  }
}

function summarizeDeliveries(rows: Array<Record<string, unknown>>) {
  return {
    tracked: rows.length,
    sent: rows.filter((row) => row.status === "sent").length,
    pending: rows.filter((row) => row.status === "pending").length,
    failed: rows.filter((row) => row.status === "failed").length,
    latest: rows[0] || null
  };
}

function compactError(result: RestResult) {
  return {
    status: result.status,
    message: (result.error || "Unavailable").slice(0, 300)
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });
}
