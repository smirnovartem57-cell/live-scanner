import type { Match, MatchEvent, MatchStatsSnapshot, TeamProfile, TeamRecentMatch } from "../../types/football";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import type { FeedbackItem, UserProfile } from "../../types/user";
import type { FootballDataProvider } from "./FootballDataProvider";
import type { MockFootballData } from "./MockFootballProvider";

export class RealFootballProvider implements FootballDataProvider {
  mode = "real" as const;

  private readonly functionName: string;
  private snapshotPromise: Promise<MockFootballData> | null = null;

  constructor(
    private readonly config: {
      supabaseUrl: string;
      anonKey: string;
      accessToken?: string;
      functionName?: string;
    },
    private readonly fallbackData: MockFootballData
  ) {
    this.functionName = config.functionName || "football-live";
  }

  async getLiveMatches(): Promise<Match[]> {
    return clone((await this.getSnapshot()).matches || []);
  }

  async getMatchStats(): Promise<MatchStatsSnapshot[]> {
    return clone((await this.getSnapshot()).snapshots || []);
  }

  async getMatchEvents(matchId?: string): Promise<Record<string, MatchEvent[]> | MatchEvent[]> {
    const events = (await this.getSnapshot()).events || {};
    return clone(matchId ? events[matchId] || [] : events);
  }

  async getPatterns(): Promise<Pattern[]> {
    const snapshot = await this.getSnapshot();
    return clone(snapshot.patterns?.length ? snapshot.patterns : this.fallbackData.patterns);
  }

  async getSeedSignals(): Promise<Signal[]> {
    return clone((await this.getSnapshot()).signals || []);
  }

  async getSeedHistory(): Promise<PatternEvent[]> {
    return clone((await this.getSnapshot()).history || []);
  }

  async getTeamProfile(teamId: string): Promise<TeamProfile | null> {
    const snapshot = await this.getSnapshot();
    return clone((snapshot.teamProfiles || this.fallbackData.teamProfiles || []).find((team) => team.id === teamId) || null);
  }

  async getTeamRecentMatches(teamId: string): Promise<TeamRecentMatch[]> {
    const profile = await this.getTeamProfile(teamId);
    return clone(profile?.recentMatches || []);
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const snapshot = await this.getSnapshot();
    return clone(snapshot.userProfile || this.fallbackData.userProfile || null);
  }

  async getFeedbackItems(): Promise<FeedbackItem[]> {
    const snapshot = await this.getSnapshot();
    return clone(snapshot.feedbackItems || this.fallbackData.feedbackItems || []);
  }

  private async getSnapshot(): Promise<MockFootballData> {
    if (!this.snapshotPromise) {
      this.snapshotPromise = this.loadSnapshot();
    }

    return this.snapshotPromise;
  }

  private async loadSnapshot(): Promise<MockFootballData> {
    const supabaseUrl = this.config.supabaseUrl.trim();
    const anonKey = this.config.anonKey.trim();

    if (!supabaseUrl || !anonKey) {
      throw new Error("Для real-режима укажите Supabase URL и anon key.");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/${this.functionName}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        ...(this.config.accessToken ? { "x-live-scanner-key": this.config.accessToken } : {}),
        "content-type": "application/json"
      },
      body: JSON.stringify({ scope: "live-snapshot" })
    });

    if (!response.ok) {
      throw new Error(`Не удалось загрузить real-данные: ${await response.text()}`);
    }

    const payload = await response.json() as { data?: Partial<MockFootballData> };

    return {
      matches: payload.data?.matches || [],
      snapshots: payload.data?.snapshots || [],
      events: payload.data?.events || {},
      signals: payload.data?.signals || [],
      patterns: payload.data?.patterns || this.fallbackData.patterns,
      history: payload.data?.history || [],
      teamProfiles: payload.data?.teamProfiles || this.fallbackData.teamProfiles || [],
      userProfile: payload.data?.userProfile || this.fallbackData.userProfile,
      feedbackItems: payload.data?.feedbackItems || this.fallbackData.feedbackItems || []
    };
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
