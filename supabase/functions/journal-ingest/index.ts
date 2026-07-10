type TeamSide = "home" | "away";
type SignalStrength = "LOW" | "MED" | "HIGH";
type SignalStatus = "new" | "in_progress" | "success" | "failed";
type SignalKind = "signal" | "warning";

type JournalEvent = {
  id: string;
  matchId: string;
  match: string;
  league: string;
  patternId: string;
  patternType: string;
  teamId?: string;
  teamSide: TeamSide;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  score: string;
  pressureScore: number;
  strength: SignalStrength;
  status: SignalStatus;
  signalKind: SignalKind;
  statsAtSignal: Record<string, unknown>;
  explanation: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  result: {
    goalWithin5: boolean;
    goalWithin10: boolean;
    goalWithin15: boolean;
    goalMinute: number | null;
    goalTeam: TeamSide | null;
    finalComment: string;
    manualOutcome?: "win" | "lose" | null;
  };
  resultSource: "auto" | "manual" | "seed";
  closedAt: string | null;
};

type PatternStatsDaily = {
  statDate: string;
  patternId: string;
  patternType: string;
  totalSignals: number;
  successWithin5: number;
  successWithin10: number;
  successWithin15: number;
  failedSignals: number;
  warningSignals: number;
  averagePressureScore: number;
  averageMinute: number;
  qualityScore: number;
};

type JournalIngestPayload = {
  events?: JournalEvent[];
  patternStats?: PatternStatsDaily[];
  ingestionRun?: {
    provider: string;
    status: "started" | "success" | "failed";
    matchesSeen?: number;
    signalsCreated?: number;
    message?: string;
    startedAt?: string;
    finishedAt?: string;
  };
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

  const payload = await request.json() as JournalIngestPayload;
  const events = payload.events || [];
  const patternStats = payload.patternStats || [];

  if (events.length) {
    await upsert(supabaseUrl, serviceRoleKey, "journal_signals", events.map(toSignalRow), "dedupe_key");
    await upsert(supabaseUrl, serviceRoleKey, "journal_signal_results", events.map(toResultRow), "signal_id");
  }

  if (patternStats.length) {
    await upsert(supabaseUrl, serviceRoleKey, "pattern_stats_daily", patternStats.map(toPatternStatsRow), "stat_date,pattern_id");
  }

  if (payload.ingestionRun) {
    await insert(supabaseUrl, serviceRoleKey, "journal_ingestion_runs", toIngestionRunRow(payload.ingestionRun));
  }

  return json({
    ok: true,
    signalsSaved: events.length,
    patternStatsSaved: patternStats.length
  });
});

function toSignalRow(event: JournalEvent) {
  return {
    id: event.id,
    dedupe_key: createDedupeKey(event),
    match_id: event.matchId,
    match_name: event.match,
    league: event.league,
    pattern_id: event.patternId,
    pattern_type: event.patternType,
    team_id: event.teamId,
    team_side: event.teamSide,
    minute: event.minute,
    score_home: event.scoreHome,
    score_away: event.scoreAway,
    score: event.score,
    pressure_score: event.pressureScore,
    strength: event.strength,
    status: event.status,
    signal_kind: event.signalKind,
    stats_at_signal: event.statsAtSignal,
    explanation: event.explanation,
    comment: event.comment,
    created_at: event.createdAt,
    updated_at: event.updatedAt
  };
}

function toResultRow(event: JournalEvent) {
  return {
    signal_id: event.id,
    goal_within_5: event.result.goalWithin5,
    goal_within_10: event.result.goalWithin10,
    goal_within_15: event.result.goalWithin15,
    goal_minute: event.result.goalMinute,
    goal_team: event.result.goalTeam,
    manual_outcome: event.result.manualOutcome,
    final_comment: event.result.finalComment,
    result_source: event.resultSource,
    closed_at: event.closedAt,
    updated_at: event.updatedAt
  };
}

function toPatternStatsRow(row: PatternStatsDaily) {
  return {
    stat_date: row.statDate,
    pattern_id: row.patternId,
    pattern_type: row.patternType,
    total_signals: row.totalSignals,
    success_within_5: row.successWithin5,
    success_within_10: row.successWithin10,
    success_within_15: row.successWithin15,
    failed_signals: row.failedSignals,
    warning_signals: row.warningSignals,
    average_pressure_score: row.averagePressureScore,
    average_minute: row.averageMinute,
    quality_score: row.qualityScore,
    updated_at: new Date().toISOString()
  };
}

function toIngestionRunRow(run: NonNullable<JournalIngestPayload["ingestionRun"]>) {
  return {
    provider: run.provider,
    status: run.status,
    matches_seen: run.matchesSeen || 0,
    signals_created: run.signalsCreated || 0,
    message: run.message,
    started_at: run.startedAt || new Date().toISOString(),
    finished_at: run.finishedAt
  };
}

async function upsert(supabaseUrl: string, key: string, table: string, rows: unknown[], onConflict: string) {
  if (!rows.length) return;
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: restHeaders(key, "resolution=merge-duplicates"),
    body: JSON.stringify(rows)
  });
  await assertOk(response, table);
}

async function insert(supabaseUrl: string, key: string, table: string, row: unknown) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders(key),
    body: JSON.stringify(row)
  });
  await assertOk(response, table);
}

function restHeaders(key: string, prefer?: string) {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {})
  };
}

async function assertOk(response: Response, table: string) {
  if (response.ok) return;
  const message = await response.text();
  throw new Error(`Failed to write ${table}: ${message}`);
}

function createDedupeKey(event: JournalEvent, windowMinutes = 10) {
  const createdAt = new Date(event.createdAt);
  const bucketMs = windowMinutes * 60 * 1000;
  const bucketStart = Math.floor(createdAt.getTime() / bucketMs) * bucketMs;
  return [event.matchId, event.patternId, event.teamSide, new Date(bucketStart).toISOString()].join(":");
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
