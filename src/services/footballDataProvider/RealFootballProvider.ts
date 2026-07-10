import type { Match, MatchEvent, MatchStatsSnapshot, TeamProfile, TeamRecentMatch } from "../../types/football";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import type { FeedbackItem, UserProfile } from "../../types/user";
import type { FootballDataProvider } from "./FootballDataProvider";

export class RealFootballProvider implements FootballDataProvider {
  mode = "real" as const;

  async getLiveMatches(): Promise<Match[]> {
    return [];
  }

  async getMatchStats(): Promise<MatchStatsSnapshot[]> {
    return [];
  }

  async getMatchEvents(_matchId?: string): Promise<Record<string, MatchEvent[]> | MatchEvent[]> {
    return _matchId ? [] : {};
  }

  async getPatterns(): Promise<Pattern[]> {
    return [];
  }

  async getSeedSignals(): Promise<Signal[]> {
    return [];
  }

  async getSeedHistory(): Promise<PatternEvent[]> {
    return [];
  }

  async getTeamProfile(_teamId: string): Promise<TeamProfile | null> {
    return null;
  }

  async getTeamRecentMatches(_teamId: string): Promise<TeamRecentMatch[]> {
    return [];
  }

  async getUserProfile(): Promise<UserProfile | null> {
    return null;
  }

  async getFeedbackItems(): Promise<FeedbackItem[]> {
    return [];
  }
}
