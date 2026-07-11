import type { Match, MatchEvent, MatchStatsSnapshot, TeamProfile, TeamRecentMatch } from "../../types/football";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import type { FeedbackItem, UserProfile } from "../../types/user";
import type { FootballDataProvider, FootballDataSourceStatus } from "./FootballDataProvider";
import type { MockFootballData } from "./MockFootballProvider";

type RealFootballSnapshotResponse = {
  ok?: boolean;
  provider?: string;
  message?: string;
  cached?: boolean;
  data?: Partial<MockFootballData>;
};

export class RealFootballProvider implements FootballDataProvider {
  mode = "real" as const;

  private readonly functionName: string;
  private snapshotPromise: Promise<RealFootballSnapshotResponse> | null = null;
  private sourceStatus: FootballDataSourceStatus = {
    mode: this.mode,
    provider: "football-live",
    message: "Ожидаем загрузку real-источника.",
    cached: false,
    loadedAt: new Date().toISOString()
  };

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

  getSourceStatus(): FootballDataSourceStatus {
    return this.sourceStatus;
  }

  async getLiveMatches(): Promise<Match[]> {
    return clone((await this.getSnapshot()).data.matches || []);
  }

  async getMatchStats(): Promise<MatchStatsSnapshot[]> {
    return clone((await this.getSnapshot()).data.snapshots || []);
  }

  async getMatchEvents(matchId?: string): Promise<Record<string, MatchEvent[]> | MatchEvent[]> {
    const events = (await this.getSnapshot()).data.events || {};
    return clone(matchId ? events[matchId] || [] : events);
  }

  async getPatterns(): Promise<Pattern[]> {
    const snapshot = await this.getSnapshot();
    return clone(snapshot.data.patterns?.length ? snapshot.data.patterns : this.fallbackData.patterns);
  }

  async getSeedSignals(): Promise<Signal[]> {
    return clone((await this.getSnapshot()).data.signals || []);
  }

  async getSeedHistory(): Promise<PatternEvent[]> {
    return clone((await this.getSnapshot()).data.history || []);
  }

  async getTeamProfile(teamId: string): Promise<TeamProfile | null> {
    const snapshot = await this.getSnapshot();
    return clone((snapshot.data.teamProfiles || this.fallbackData.teamProfiles || []).find((team) => team.id === teamId) || null);
  }

  async getTeamRecentMatches(teamId: string): Promise<TeamRecentMatch[]> {
    const profile = await this.getTeamProfile(teamId);
    return clone(profile?.recentMatches || []);
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const snapshot = await this.getSnapshot();
    return clone(snapshot.data.userProfile || this.fallbackData.userProfile || null);
  }

  async getFeedbackItems(): Promise<FeedbackItem[]> {
    const snapshot = await this.getSnapshot();
    return clone(snapshot.data.feedbackItems || this.fallbackData.feedbackItems || []);
  }

  private async getSnapshot(): Promise<Required<RealFootballSnapshotResponse> & { data: MockFootballData }> {
    if (!this.snapshotPromise) {
      this.snapshotPromise = this.loadSnapshot();
    }

    const response = await this.snapshotPromise;
    return normalizeSnapshotResponse(response, this.fallbackData);
  }

  private async loadSnapshot(): Promise<RealFootballSnapshotResponse> {
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

    const payload = await response.json() as RealFootballSnapshotResponse;
    this.sourceStatus = {
      mode: this.mode,
      provider: payload.provider || this.functionName,
      message: payload.message || "Real-источник загружен.",
      cached: Boolean(payload.cached),
      loadedAt: new Date().toISOString()
    };

    return payload;
  }
}

function normalizeSnapshotResponse(response: RealFootballSnapshotResponse, fallbackData: MockFootballData) {
  return {
    ok: Boolean(response.ok),
    provider: response.provider || "football-live",
    message: response.message || "",
    cached: Boolean(response.cached),
    data: {
      matches: response.data?.matches || [],
      snapshots: response.data?.snapshots || [],
      events: response.data?.events || {},
      signals: response.data?.signals || [],
      patterns: response.data?.patterns || fallbackData.patterns,
      history: response.data?.history || [],
      teamProfiles: response.data?.teamProfiles || fallbackData.teamProfiles || [],
      userProfile: response.data?.userProfile || fallbackData.userProfile,
      feedbackItems: response.data?.feedbackItems || fallbackData.feedbackItems || []
    }
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
