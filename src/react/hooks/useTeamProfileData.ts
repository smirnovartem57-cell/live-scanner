import { useEffect, useState } from "react";
import type { Match, TeamProfile } from "../../types/football";
import {
  getFootballDataAccessToken,
  hasSupabaseConnectionSettings,
  type ReactSettings
} from "../domain/settings";
import type { TeamProfileSelection } from "../domain/teamProfile";

type TeamProfileState = {
  profile: TeamProfile | null;
  loading: boolean;
  error: string | null;
};

export function useTeamProfileData(
  settings: ReactSettings,
  selection: TeamProfileSelection | null,
  match: Match | null
): TeamProfileState {
  const [state, setState] = useState<TeamProfileState>({
    profile: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    const accessToken = getFootballDataAccessToken(settings);
    const teamId = selection?.teamId ||
      (selection?.side === "home" ? match?.homeTeamId : match?.awayTeamId);
    if (
      settings.mockMode ||
      !selection ||
      !match ||
      !teamId ||
      !hasSupabaseConnectionSettings(settings) ||
      !accessToken
    ) {
      setState({ profile: null, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ profile: null, loading: true, error: null });

    void fetch(`${settings.supabaseUrl.trim()}/functions/v1/${settings.teamProfileFunctionName.trim() || "team-profile"}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        apikey: settings.supabaseAnonKey.trim(),
        authorization: `Bearer ${settings.supabaseAnonKey.trim()}`,
        "x-live-scanner-key": accessToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        teamId,
        leagueId: match.leagueId,
        season: match.season
      })
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Профиль команды недоступен: ${await response.text()}`);
      return await response.json() as { profile?: TeamProfile; message?: string };
    }).then((payload) => {
      if (!controller.signal.aborted) {
        setState({
          profile: payload.profile ? {
            ...payload.profile,
            dataStatus: payload.profile.recentMatches?.length ? "ready" : "partial",
            dataMessage: payload.message
          } : null,
          loading: false,
          error: payload.profile ? null : payload.message || "Подробный профиль пока недоступен."
        });
      }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setState({
          profile: null,
          loading: false,
          error: error instanceof Error ? error.message : "Не удалось загрузить профиль команды."
        });
      }
    });

    return () => controller.abort();
  }, [
    match,
    selection,
    settings.footballDataAccessToken,
    settings.journalAccessToken,
    settings.mockMode,
    settings.supabaseAnonKey,
    settings.supabaseUrl,
    settings.teamProfileFunctionName
  ]);

  return state;
}
