type JournalReadPayload = {
  limit?: number;
  includePatternStats?: boolean;
  patternStatsDays?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase function is not configured" }, 500);
  }

  const payload = await request.json() as JournalReadPayload;
  const limit = clamp(payload.limit || 100, 1, 500);
  const patternStatsDays = clamp(payload.patternStatsDays || 30, 1, 365);

  const signals = await select(
    supabaseUrl,
    serviceRoleKey,
    "journal_signals",
    `select=*,journal_signal_results(*)&order=created_at.desc&limit=${limit}`
  );

  const patternStats = payload.includePatternStats
    ? await select(
      supabaseUrl,
      serviceRoleKey,
      "pattern_stats_daily",
      `select=*&stat_date=gte.${dateDaysAgo(patternStatsDays)}&order=stat_date.desc`
    )
    : [];

  return json({
    ok: true,
    signals,
    patternStats
  });
});

async function select(supabaseUrl: string, key: string, table: string, query: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to read ${table}: ${await response.text()}`);
  }

  return await response.json();
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
