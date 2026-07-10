import type { Match, MatchEvent, MatchStatsSnapshot, TeamProfile, TeamRecentMatch } from "../../types/football";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import type { FeedbackItem, UserProfile } from "../../types/user";

export type FootballDataMode = "mock" | "real";

export interface FootballDataProvider {
  mode: FootballDataMode;
  getLiveMatches(): Promise<Match[]>;
  getMatchStats(): Promise<MatchStatsSnapshot[]>;
  getMatchEvents(matchId?: string): Promise<Record<string, MatchEvent[]> | MatchEvent[]>;
  getPatterns(): Promise<Pattern[]>;
  getSeedSignals(): Promise<Signal[]>;
  getSeedHistory(): Promise<PatternEvent[]>;
  getTeamProfile(teamId: string): Promise<TeamProfile | null>;
  getTeamRecentMatches(teamId: string): Promise<TeamRecentMatch[]>;
  getUserProfile(): Promise<UserProfile | null>;
  getFeedbackItems(): Promise<FeedbackItem[]>;
}
