import type { PatternEvent, Signal } from "../../types/patterns";

export type JournalStorageMode = "mock" | "supabase";

export type JournalIngestionRun = {
  provider: string;
  status: "started" | "success" | "failed";
  matchesSeen?: number;
  signalsCreated?: number;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type JournalSignalDedupeInput = {
  matchId: string;
  patternId: string;
  teamSide: Signal["teamSide"];
  createdAt: string;
};

export type PatternStatsDaily = {
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

export interface JournalStorage {
  mode: JournalStorageMode;
  createSignals(events: PatternEvent[]): Promise<PatternEvent[]>;
  getRecentSignal(input: JournalSignalDedupeInput, windowMinutes: number): Promise<PatternEvent | null>;
  upsertSignalResult(event: PatternEvent): Promise<void>;
  listSignalHistory(limit?: number): Promise<PatternEvent[]>;
  upsertPatternStatsDaily(stats: PatternStatsDaily[]): Promise<void>;
  recordIngestionRun(input: JournalIngestionRun): Promise<void>;
}
