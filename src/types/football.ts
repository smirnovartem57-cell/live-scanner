export type TeamSide = "home" | "away";

export type MatchStatus = "live" | "halftime" | "finished" | "scheduled";

export type Match = {
  id: string;
  league: string;
  country?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeam: string;
  awayTeam: string;
  minute: number;
  status: MatchStatus;
  scoreHome: number;
  scoreAway: number;
  isTopLeague?: boolean;
  updatedAt?: string;
};

export type TeamStats = {
  attacks?: number;
  dangerousAttacks?: number;
  shotsTotal?: number;
  shotsOnTarget?: number;
  corners?: number;
  possession?: number;
  xg?: number;
  xG?: number;
};

export type MatchStatsSnapshot = {
  id?: string;
  matchId: string;
  minute?: number;
  createdAt?: string;
  home: TeamStats;
  away: TeamStats;
  last10?: Partial<Record<TeamSide, TeamStats>>;
  previous10?: Partial<Record<TeamSide, TeamStats>>;
  recent?: Partial<Record<TeamSide, TeamStats>>;
  previous?: Partial<Record<TeamSide, TeamStats>>;
};

export type MatchEvent = {
  id: string;
  type: "goal" | "card" | "substitution" | "period";
  minute: number;
  teamSide?: TeamSide;
  teamId?: string;
  scoreHome?: number;
  scoreAway?: number;
};

export type TeamProfile = {
  id: string;
  name: string;
  country?: string;
  league?: string;
  logo?: string;
  recentMatches?: TeamRecentMatch[];
  averages?: Record<string, number>;
  firstHalfAverages?: TeamStats;
  secondHalfAverages?: TeamStats;
  characteristicPatterns?: TeamPatternSummary[];
  importantMatches?: unknown[];
  updatedAt?: string;
};

export type TeamRecentMatch = {
  date: string;
  opponent: string;
  score: string;
  tournament: string;
  status: "win" | "draw" | "loss";
  importanceLevel?: "low" | "medium" | "high";
  importanceReason?: string;
};

export type TeamPatternSummary = {
  teamId: string;
  patternId: string;
  patternName: string;
  totalSignals: number;
  successWithin10: number;
  successWithin15: number;
  successRate10: number;
  successRate15: number;
  averageMinute: number;
  averagePressureScore: number;
  label: "strong" | "normal" | "weak" | "not_enough_data";
};
