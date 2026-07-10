import type { TeamSide, TeamStats } from "./football";

export type PatternRule = {
  label?: string;
  field: string;
  operator: string;
  value: number | string;
  period?: string;
};

export type Pattern = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: string;
  rules: PatternRule[];
  analyticsStatus?: "testing";
};

export type SignalStrength = "LOW" | "MED" | "HIGH";

export type SignalStatus = "new" | "in_progress" | "success" | "failed";

export type SignalKind = "signal" | "warning";

export type SignalResult = {
  goalWithin5: boolean;
  goalWithin10: boolean;
  goalWithin15: boolean;
  goalMinute: number | null;
  goalTeam: TeamSide | null;
  finalComment: string;
  manualOutcome?: "win" | "lose" | null;
};

export type Signal = {
  id: string;
  matchId: string;
  patternId: string;
  patternType: string;
  teamId?: string;
  teamSide: TeamSide;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  pressureScore: number;
  strength: SignalStrength;
  status: SignalStatus;
  signalKind: SignalKind;
  statsAtSignal: TeamStats;
  explanation: string;
  createdAt: string;
  updatedAt: string;
};

export type PatternEvent = Signal & {
  match: string;
  league: string;
  score: string;
  result: SignalResult;
  comment: string;
  resultSource: "auto" | "manual" | "seed";
  closedAt: string | null;
};

export type PatternConditionProfile = {
  id: string;
  patternId: string;
  name: string;
  rules: Array<Pick<PatternRule, "value">>;
  createdAt: string;
};
