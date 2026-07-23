import type { PatternEvent, SignalKind, SignalResult, SignalStatus, SignalStrength } from "../../types/patterns";
import type { TeamSide, TeamStats } from "../../types/football";
import type { PatternStatsDaily } from "./JournalStorage";

export type JournalReadClientConfig = {
  supabaseUrl: string;
  anonKey: string;
  accessToken?: string;
  functionName?: string;
};

export type JournalReadOptions = {
  limit?: number;
  includePatternStats?: boolean;
  patternStatsDays?: number;
  includeDiagnostics?: boolean;
};

export type JournalReadResult = {
  ok: boolean;
  history: PatternEvent[];
  patternStats: PatternStatsDaily[];
};

type JournalSignalRow = {
  id: string;
  match_id: string;
  match_name: string;
  league: string;
  pattern_id: string;
  pattern_type: string;
  team_id?: string | null;
  team_side: TeamSide;
  minute: number;
  score_home: number;
  score_away: number;
  score: string;
  pressure_score: number;
  strength: SignalStrength;
  status: SignalStatus;
  signal_kind: SignalKind;
  stats_at_signal: TeamStats;
  explanation: string;
  comment: string;
  created_at: string;
  updated_at: string;
  // PostgREST may represent the one-to-one relation as an object, while older
  // deployments/configurations can still return a one-element array.
  journal_signal_results?: JournalResultRow | JournalResultRow[] | null;
};

type JournalResultRow = {
  goal_within_5: boolean;
  goal_within_10: boolean;
  goal_within_15: boolean;
  goal_minute: number | null;
  goal_team: TeamSide | null;
  manual_outcome?: "win" | "lose" | null;
  final_comment: string;
  result_source: "auto" | "manual" | "seed";
  closed_at: string | null;
};

type PatternStatsRow = {
  stat_date: string;
  pattern_id: string;
  pattern_type: string;
  total_signals: number;
  success_within_5: number;
  success_within_10: number;
  success_within_15: number;
  failed_signals: number;
  warning_signals: number;
  average_pressure_score: number;
  average_minute: number;
  quality_score: number;
};

type JournalReadResponse = {
  ok: boolean;
  signals?: JournalSignalRow[];
  patternStats?: PatternStatsRow[];
};

export class JournalReadClient {
  private readonly functionName: string;

  constructor(private readonly config: JournalReadClientConfig) {
    this.functionName = config.functionName || "journal-read";
  }

  async read(options: JournalReadOptions = {}): Promise<JournalReadResult> {
    const response = await fetch(`${this.config.supabaseUrl}/functions/v1/${this.functionName}`, {
      method: "POST",
      headers: {
        apikey: this.config.anonKey,
        authorization: `Bearer ${this.config.anonKey}`,
        ...(this.config.accessToken ? { "x-live-scanner-key": this.config.accessToken } : {}),
        "content-type": "application/json"
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      throw new Error(`Journal read failed: ${await response.text()}`);
    }

    const data = await response.json() as JournalReadResponse;

    return {
      ok: data.ok,
      history: (data.signals || [])
        .filter((row) => options.includeDiagnostics || !isDiagnosticRow(row.pattern_id))
        .map(toPatternEvent),
      patternStats: (data.patternStats || [])
        .filter((row) => options.includeDiagnostics || !isDiagnosticRow(row.pattern_id))
        .map(toPatternStats)
    };
  }
}

function isDiagnosticRow(patternId: string) {
  return patternId === "diagnostic_roundtrip";
}

export function toPatternEvent(row: JournalSignalRow): PatternEvent {
  const resultRow = firstResultRow(row.journal_signal_results);
  const result = toSignalResult(resultRow);

  return {
    id: row.id,
    matchId: row.match_id,
    match: row.match_name,
    league: row.league,
    patternId: row.pattern_id,
    patternType: row.pattern_type,
    teamId: row.team_id || undefined,
    teamSide: row.team_side,
    minute: row.minute,
    scoreHome: row.score_home,
    scoreAway: row.score_away,
    score: row.score,
    pressureScore: row.pressure_score,
    strength: row.strength,
    status: row.status,
    signalKind: row.signal_kind,
    statsAtSignal: row.stats_at_signal || {},
    explanation: row.explanation,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    result,
    resultSource: resultRow?.result_source || "auto",
    closedAt: resultRow?.closed_at || null
  };
}

function firstResultRow(value: JournalSignalRow["journal_signal_results"]): JournalResultRow | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value || undefined;
}

function toSignalResult(row?: JournalResultRow): SignalResult {
  return {
    goalWithin5: Boolean(row?.goal_within_5),
    goalWithin10: Boolean(row?.goal_within_10),
    goalWithin15: Boolean(row?.goal_within_15),
    goalMinute: row?.goal_minute || null,
    goalTeam: row?.goal_team || null,
    finalComment: row?.final_comment || "",
    manualOutcome: row?.manual_outcome || null
  };
}

function toPatternStats(row: PatternStatsRow): PatternStatsDaily {
  return {
    statDate: row.stat_date,
    patternId: row.pattern_id,
    patternType: row.pattern_type,
    totalSignals: row.total_signals,
    successWithin5: row.success_within_5,
    successWithin10: row.success_within_10,
    successWithin15: row.success_within_15,
    failedSignals: row.failed_signals,
    warningSignals: row.warning_signals,
    averagePressureScore: row.average_pressure_score,
    averageMinute: row.average_minute,
    qualityScore: row.quality_score
  };
}
