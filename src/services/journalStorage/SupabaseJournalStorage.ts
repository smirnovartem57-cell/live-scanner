import type { PatternEvent } from "../../types/patterns";
import { createJournalDedupeKey } from "./createJournalDedupeKey";
import { toPatternEvent, type JournalSignalRow } from "./JournalReadClient";
import type { JournalIngestionRun, JournalSignalDedupeInput, JournalStorage, PatternStatsDaily } from "./JournalStorage";

export type SupabaseClientLike = {
  from(table: string): any;
};

export class SupabaseJournalStorage implements JournalStorage {
  mode = "supabase" as const;

  constructor(private readonly client: SupabaseClientLike) {}

  async createSignals(events: PatternEvent[]): Promise<PatternEvent[]> {
    await execute(
      this.client.from("journal_signals").upsert(
        events.map((event) => ({
          id: event.id,
          dedupe_key: createJournalDedupeKey({
            matchId: event.matchId,
            patternId: event.patternId,
            teamSide: event.teamSide,
            createdAt: event.createdAt
          }),
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
        })),
        { onConflict: "dedupe_key", ignoreDuplicates: true }
      )
    );

    for (const event of events) {
      await this.upsertSignalResult(event);
    }

    return events;
  }

  async getRecentSignal(input: JournalSignalDedupeInput, windowMinutes: number): Promise<PatternEvent | null> {
    const since = new Date(new Date(input.createdAt).getTime() - windowMinutes * 60 * 1000).toISOString();
    const result = await this.client
      .from("journal_signals")
      .select("*,journal_signal_results(*)")
      .eq("match_id", input.matchId)
      .eq("pattern_id", input.patternId)
      .eq("team_side", input.teamSide)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() as { data?: JournalSignalRow | null; error?: Error | null };
    if (result.error) throw result.error;
    return result.data ? toPatternEvent(result.data) : null;
  }

  async upsertSignalResult(event: PatternEvent): Promise<void> {
    await execute(
      this.client.from("journal_signal_results").upsert(
        {
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
        },
        { onConflict: "signal_id" }
      )
    );
  }

  async listSignalHistory(limit = 100): Promise<PatternEvent[]> {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    const result = await this.client
      .from("journal_signals")
      .select("*,journal_signal_results(*)")
      .order("created_at", { ascending: false })
      .limit(safeLimit) as { data?: JournalSignalRow[] | null; error?: Error | null };
    if (result.error) throw result.error;
    return (result.data || []).map(toPatternEvent);
  }

  async upsertPatternStatsDaily(stats: PatternStatsDaily[]): Promise<void> {
    await execute(
      this.client.from("pattern_stats_daily").upsert(
        stats.map((row) => ({
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
        })),
        { onConflict: "stat_date,pattern_id" }
      )
    );
  }

  async recordIngestionRun(input: JournalIngestionRun): Promise<void> {
    await execute(
      this.client.from("journal_ingestion_runs").insert({
        provider: input.provider,
        status: input.status,
        matches_seen: input.matchesSeen || 0,
        signals_created: input.signalsCreated || 0,
        message: input.message,
        started_at: input.startedAt || new Date().toISOString(),
        finished_at: input.finishedAt
      })
    );
  }
}

async function execute(value: unknown) {
  const result = await value as { error?: Error | null };
  if (result?.error) {
    throw result.error;
  }
}
