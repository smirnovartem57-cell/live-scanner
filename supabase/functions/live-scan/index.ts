import { defaultPatterns } from "../../../src/services/patternEngine/defaultPatterns.ts";
import { evaluateMatch } from "../../../src/services/patternEngine/evaluateMatch.ts";
import { buildPatternEvent, buildPatternStatsDaily } from "../../../src/services/journalStorage/buildJournalEvents.ts";
import { JournalIngestClient } from "../../../src/services/journalStorage/JournalIngestClient.ts";
import { JournalReadClient } from "../../../src/services/journalStorage/JournalReadClient.ts";
import { TelegramClient } from "../../../src/services/telegram/TelegramClient.ts";
import type { Match, MatchEvent, MatchStatsSnapshot } from "../../../src/types/football.ts";
import type { PatternEvent, Signal } from "../../../src/types/patterns.ts";

type LiveSnapshot = {
  matches?: Match[];
  snapshots?: MatchStatsSnapshot[];
  events?: Record<string, MatchEvent[]>;
};

type FootballLiveResponse = {
  ok?: boolean;
  provider?: string;
  message?: string;
  cached?: boolean;
  data?: LiveSnapshot;
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

  const startedAt = new Date().toISOString();

  try {
    const config = getConfig();
    const [snapshotResponse, journal] = await Promise.all([
      loadFootballSnapshot(config),
      new JournalReadClient({
        supabaseUrl: config.supabaseUrl,
        anonKey: config.anonKey,
        accessToken: config.journalToken
      }).read({ limit: 500, includePatternStats: true, patternStatsDays: 365 })
    ]);

    const snapshot = snapshotResponse.data || {};
    const matches = snapshot.matches || [];
    const snapshots = snapshot.snapshots || [];
    const events = snapshot.events || {};
    const generatedSignals = generateSignals(matches, snapshots, journal.history);
    const newEvents = generatedSignals.map((signal) => {
      const match = matches.find((item) => item.id === signal.matchId)!;
      return buildPatternEvent(signal, match, events[signal.matchId] || []);
    });
    const updatedEvents = updateOpenEvents(journal.history, matches, events);
    const changedEvents = [...newEvents, ...updatedEvents];
    const mergedHistory = mergeHistory(journal.history, changedEvents);

    const ingestResult = await new JournalIngestClient({
      supabaseUrl: config.supabaseUrl,
      anonKey: config.anonKey,
      accessToken: config.journalToken
    }).send({
      events: changedEvents,
      patternStats: buildPatternStatsDaily(mergedHistory),
      ingestionRun: {
        provider: "scheduled-live-scan",
        status: "success",
        matchesSeen: matches.length,
        signalsCreated: newEvents.length,
        message: snapshotResponse.message || "Scheduled live scan completed.",
        startedAt,
        finishedAt: new Date().toISOString()
      }
    });

    const telegram = await sendTelegram(config, newEvents);

    return json({
      ok: true,
      provider: snapshotResponse.provider || "football-live",
      cached: Boolean(snapshotResponse.cached),
      matchesSeen: matches.length,
      signalsCreated: newEvents.length,
      resultsUpdated: updatedEvents.length,
      signalsSaved: ingestResult.signalsSaved,
      telegramSent: telegram.sent,
      telegramSkipped: telegram.skipped,
      message: snapshotResponse.message || "Scheduled live scan completed."
    });
  } catch (error) {
    console.error("Scheduled live scan failed", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Scheduled live scan failed",
      startedAt,
      finishedAt: new Date().toISOString()
    }, 500);
  }
});

function getConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SB_PUBLISHABLE_KEY"))?.trim();
  const journalToken = Deno.env.get("JOURNAL_ACCESS_TOKEN")?.trim();
  const footballToken = (Deno.env.get("FOOTBALL_DATA_ACCESS_TOKEN") || journalToken)?.trim();
  const telegramToken = (Deno.env.get("TELEGRAM_ACCESS_TOKEN") || journalToken)?.trim();
  const telegramChannel = Deno.env.get("TELEGRAM_CHANNEL")?.trim() || "";

  if (!supabaseUrl || !anonKey || !journalToken || !footballToken || !telegramToken) {
    throw new Error("Live scan function secrets are incomplete.");
  }

  return { supabaseUrl, anonKey, journalToken, footballToken, telegramToken, telegramChannel };
}

async function loadFootballSnapshot(config: ReturnType<typeof getConfig>) {
  const response = await fetch(`${config.supabaseUrl}/functions/v1/football-live`, {
    method: "POST",
    headers: functionHeaders(config.anonKey, config.footballToken),
    body: JSON.stringify({ scope: "live-snapshot" })
  });

  if (!response.ok) throw new Error(`football-live failed: ${await response.text()}`);
  const payload = await response.json() as FootballLiveResponse;
  if (!payload.ok) throw new Error(payload.message || "football-live returned an unsuccessful result.");
  return payload;
}

function generateSignals(matches: Match[], snapshots: MatchStatsSnapshot[], history: PatternEvent[]) {
  return snapshots.reduce<Signal[]>((signals, snapshot) => {
    const match = matches.find((item) => item.id === snapshot.matchId);
    if (!match) return signals;
    return [...signals, ...evaluateMatch(match, snapshot, defaultPatterns, [...history, ...signals])];
  }, []);
}

function updateOpenEvents(history: PatternEvent[], matches: Match[], events: Record<string, MatchEvent[]>) {
  return history
    .filter((event) => event.resultSource === "auto" && !event.result.manualOutcome)
    .filter((event) => event.status === "new" || event.status === "in_progress")
    .map((event) => {
      const match = matches.find((item) => item.id === event.matchId);
      if (!match) return null;
      const updated = buildPatternEvent(event, match, events[event.matchId] || []);
      return hasResultChanged(event, updated) ? updated : null;
    })
    .filter((event): event is PatternEvent => Boolean(event));
}

function hasResultChanged(previous: PatternEvent, next: PatternEvent) {
  return previous.status !== next.status ||
    previous.result.goalWithin5 !== next.result.goalWithin5 ||
    previous.result.goalWithin10 !== next.result.goalWithin10 ||
    previous.result.goalWithin15 !== next.result.goalWithin15 ||
    previous.result.goalMinute !== next.result.goalMinute ||
    previous.result.goalTeam !== next.result.goalTeam ||
    previous.result.finalComment !== next.result.finalComment;
}

function mergeHistory(history: PatternEvent[], updates: PatternEvent[]) {
  const byId = new Map(history.map((event) => [event.id, event]));
  for (const event of updates) byId.set(event.id, event);
  return [...byId.values()];
}

async function sendTelegram(config: ReturnType<typeof getConfig>, events: PatternEvent[]) {
  if (!config.telegramChannel || !events.length) {
    return { sent: 0, skipped: events.length };
  }

  const client = new TelegramClient({
    supabaseUrl: config.supabaseUrl,
    anonKey: config.anonKey,
    accessToken: config.telegramToken
  });
  let sent = 0;

  for (const event of events) {
    try {
      await client.sendSignal(config.telegramChannel, event);
      sent += 1;
    } catch (error) {
      console.warn(`Telegram delivery failed for ${event.id}`, error);
    }
  }

  return { sent, skipped: events.length - sent };
}

function hasAccess(request: Request) {
  const expected = Deno.env.get("LIVE_SCAN_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expected) && request.headers.get("x-live-scanner-key") === expected;
}

function functionHeaders(anonKey: string, accessToken: string) {
  return {
    apikey: anonKey,
    authorization: `Bearer ${anonKey}`,
    "x-live-scanner-key": accessToken,
    "content-type": "application/json"
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });
}
