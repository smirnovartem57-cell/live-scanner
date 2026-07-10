import type { Match, MatchEvent, MatchStatsSnapshot, TeamProfile, TeamRecentMatch } from "../../types/football";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import type { FeedbackItem, UserProfile } from "../../types/user";
import type { FootballDataProvider } from "./FootballDataProvider";

export type MockFootballData = {
  matches: Match[];
  snapshots: MatchStatsSnapshot[];
  events?: Record<string, MatchEvent[]>;
  signals?: Signal[];
  patterns: Pattern[];
  history: PatternEvent[];
  teamProfiles?: TeamProfile[];
  userProfile?: UserProfile;
  feedbackItems?: FeedbackItem[];
};

export class MockFootballProvider implements FootballDataProvider {
  mode = "mock" as const;

  constructor(private readonly data: MockFootballData) {}

  async getLiveMatches(): Promise<Match[]> {
    const updatedAt = new Date().toISOString();
    return clone(this.data.matches).map((match) => ({ ...match, updatedAt }));
  }

  async getMatchStats(): Promise<MatchStatsSnapshot[]> {
    return clone(this.data.snapshots);
  }

  async getMatchEvents(matchId?: string): Promise<Record<string, MatchEvent[]> | MatchEvent[]> {
    const events = this.data.events || {};
    return clone(matchId ? events[matchId] || [] : events);
  }

  async getPatterns(): Promise<Pattern[]> {
    return clone(this.data.patterns);
  }

  async getSeedSignals(): Promise<Signal[]> {
    return clone(this.data.signals || []);
  }

  async getSeedHistory(): Promise<PatternEvent[]> {
    return clone(this.data.history);
  }

  async getTeamProfile(teamId: string): Promise<TeamProfile | null> {
    return clone((this.data.teamProfiles || []).find((team) => team.id === teamId) || null);
  }

  async getTeamRecentMatches(teamId: string): Promise<TeamRecentMatch[]> {
    const profile = (this.data.teamProfiles || []).find((team) => team.id === teamId);
    return clone(profile?.recentMatches || []);
  }

  async getUserProfile(): Promise<UserProfile | null> {
    return clone(this.data.userProfile || null);
  }

  async getFeedbackItems(): Promise<FeedbackItem[]> {
    return clone(this.data.feedbackItems || []);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
