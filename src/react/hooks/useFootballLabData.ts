import { useCallback, useEffect, useMemo, useState } from "react";
import { MockFootballProvider, RealFootballProvider } from "../../services/footballDataProvider";
import { SocialDataClient } from "../../services/socialData";
import type { FootballDataSourceStatus } from "../../services/footballDataProvider";
import { evaluateMatch } from "../../services/patternEngine";
import type { Match, MatchEvent, MatchStatsSnapshot, TeamProfile } from "../../types/football";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import type { FeedbackItem, UserProfile } from "../../types/user";
import { applyPatternSettings, getFootballDataAccessToken, getSocialDataAccessToken, hasSupabaseConnectionSettings, type ReactSettings } from "../domain/settings";
import { getBrowserMockData } from "../mockData";

export type FootballLabViewModel = {
  matches: Match[];
  snapshots: MatchStatsSnapshot[];
  events: Record<string, MatchEvent[]>;
  teamProfiles: TeamProfile[];
  patterns: Pattern[];
  signals: Signal[];
  history: PatternEvent[];
  userProfile: UserProfile | null;
  feedbackItems: FeedbackItem[];
  lastLoadedAt: string;
  providerMode: "mock" | "real";
  sourceStatus: FootballDataSourceStatus;
};

export type FootballLabSummary = {
  matchesCount: number;
  activeSignalsCount: number;
  highSignalsCount: number;
  patternsCount: number;
};

export function useFootballLabData(settings: ReactSettings) {
  const [data, setData] = useState<FootballLabViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    setError(null);
    setLoading(!isRefresh);
    setRefreshing(isRefresh);

    try {
      const mockData = getBrowserMockData();
      const footballDataAccessToken = getFootballDataAccessToken(settings);

      if (!settings.mockMode && (!hasSupabaseConnectionSettings(settings) || !footballDataAccessToken)) {
        throw new Error("Real-режим требует Supabase URL, anon key и access token. Включите демо-данные или заполните настройки защищенного доступа.");
      }

      const provider = settings.mockMode
        ? new MockFootballProvider(mockData)
        : new RealFootballProvider(
          {
            supabaseUrl: settings.supabaseUrl,
            anonKey: settings.supabaseAnonKey,
            accessToken: footballDataAccessToken,
            functionName: settings.footballDataFunctionName
          },
          mockData
        );
      const [matches, snapshots, eventsResult, providerPatterns, seedSignals, history, fallbackUserProfile, fallbackFeedbackItems] = await Promise.all([
        provider.getLiveMatches(),
        provider.getMatchStats(),
        provider.getMatchEvents(),
        provider.getPatterns(),
        provider.getSeedSignals(),
        provider.getSeedHistory(),
        provider.getUserProfile(),
        provider.getFeedbackItems()
      ]);
      const patterns = applyPatternSettings(providerPatterns, settings.patternRuleOverrides, settings.patternEnabledOverrides);
      const events = Array.isArray(eventsResult) ? {} : eventsResult;
      const teamIds = [...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean))] as string[];
      const teamProfiles = (await Promise.all(teamIds.map((teamId) => provider.getTeamProfile(teamId))))
        .filter((profile): profile is TeamProfile => Boolean(profile));
      const generatedSignals = buildGeneratedSignals(matches, snapshots, patterns, seedSignals);
      let userProfile = fallbackUserProfile;
      let feedbackItems = fallbackFeedbackItems;
      if (!settings.mockMode && getSocialDataAccessToken(settings)) {
        try {
          const social = await new SocialDataClient({
            supabaseUrl: settings.supabaseUrl,
            anonKey: settings.supabaseAnonKey,
            accessToken: getSocialDataAccessToken(settings),
            functionName: settings.socialDataFunctionName
          }).read();
          userProfile = social.profile || fallbackUserProfile;
          feedbackItems = social.feedbackItems.length ? social.feedbackItems : fallbackFeedbackItems;
        } catch (socialError) {
          console.warn("Social data loading failed", socialError);
        }
      }

      setData({
        matches,
        snapshots,
        events,
        teamProfiles,
        patterns,
        signals: [...seedSignals, ...generatedSignals],
        history,
        userProfile,
        feedbackItems,
        lastLoadedAt: new Date().toISOString(),
        providerMode: provider.mode,
        sourceStatus: provider.getSourceStatus()
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    settings.footballDataAccessToken,
    settings.footballDataFunctionName,
    settings.journalAccessToken,
    settings.mockMode,
    settings.patternEnabledOverrides,
    settings.patternRuleOverrides,
    settings.supabaseAnonKey,
    settings.supabaseUrl,
    settings.socialDataAccessToken,
    settings.socialDataFunctionName
  ]);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      if (active) {
        await load(false);
      }
    }

    loadInitial();

    return () => {
      active = false;
    };
  }, [load]);

  const summary = useMemo<FootballLabSummary>(() => {
    const signals = data?.signals || [];

    return {
      matchesCount: data?.matches.length || 0,
      activeSignalsCount: signals.length,
      highSignalsCount: signals.filter((signal) => signal.strength === "HIGH").length,
      patternsCount: data?.patterns.filter((pattern) => pattern.enabled).length || 0
    };
  }, [data]);

  const reload = useCallback(() => load(true), [load]);

  const voteFeedback = useCallback(async (feedbackId: string) => {
    const accessToken = getSocialDataAccessToken(settings);
    if (!hasSupabaseConnectionSettings(settings) || !accessToken) throw new Error("Backend идей ещё не настроен.");
    const result = await new SocialDataClient({
      supabaseUrl: settings.supabaseUrl,
      anonKey: settings.supabaseAnonKey,
      accessToken,
      functionName: settings.socialDataFunctionName
    }).vote(feedbackId);
    setData((current) => current ? { ...current, feedbackItems: result.feedbackItems } : current);
  }, [settings]);

  return { data, error, loading, refreshing, reload, summary, voteFeedback };
}

function buildGeneratedSignals(
  matches: Match[],
  snapshots: MatchStatsSnapshot[],
  patterns: Pattern[],
  seedSignals: Signal[]
): Signal[] {
  return snapshots.reduce<Signal[]>((signals, snapshot) => {
    const match = matches.find((item) => item.id === snapshot.matchId);
    if (!match) return signals;

    return [
      ...signals,
      ...evaluateMatch(match, snapshot, patterns, [...seedSignals, ...signals])
    ];
  }, []);
}
