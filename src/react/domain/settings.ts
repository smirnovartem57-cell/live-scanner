import { buildPatternStatsDaily, JournalIngestClient } from "../../services/journalStorage";
import type { PatternEvent } from "../../types/patterns";

export type TelegramTestResult = {
  ok: boolean;
  mode: "mock";
  channel: string;
  message: string;
  createdAt: string;
};

export type JournalSyncTestResult = {
  ok: boolean;
  mode: "supabase" | "mock";
  message: string;
  signalsSaved: number;
  patternStatsSaved: number;
  createdAt: string;
};

export type FootballDataTestResult = {
  ok: boolean;
  provider: string;
  message: string;
  matchesLoaded: number;
  cached: boolean;
  createdAt: string;
};

export type ReactSettings = {
  mockMode: boolean;
  telegramEnabled: boolean;
  telegramChannel: string;
  journalStorageEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  journalAccessToken: string;
  footballDataFunctionName: string;
  footballDataAccessToken: string;
  favoriteLeagues: string[];
  lastTelegramTest: TelegramTestResult | null;
  lastJournalSync: JournalSyncTestResult | null;
  lastFootballDataTest: FootballDataTestResult | null;
};

const settingsKey = "football-pattern-lab-settings";

export const defaultReactSettings: ReactSettings = {
  mockMode: true,
  telegramEnabled: false,
  telegramChannel: "",
  journalStorageEnabled: false,
  supabaseUrl: "",
  supabaseAnonKey: "",
  journalAccessToken: "",
  footballDataFunctionName: "football-live",
  footballDataAccessToken: "",
  favoriteLeagues: ["Spain LaLiga", "Italy Serie A", "Portugal Primeira"],
  lastTelegramTest: null,
  lastJournalSync: null,
  lastFootballDataTest: null
};

export function readReactSettings(): ReactSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(settingsKey) || "null") as Partial<ReactSettings> | null;
    return { ...defaultReactSettings, ...(stored || {}) };
  } catch {
    return defaultReactSettings;
  }
}

export function writeReactSettings(settings: ReactSettings) {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

export function getJournalAccessToken(settings: ReactSettings): string {
  return settings.journalAccessToken.trim();
}

export function getFootballDataAccessToken(settings: ReactSettings): string {
  return (settings.footballDataAccessToken || settings.journalAccessToken).trim();
}

export function hasSupabaseConnectionSettings(settings: ReactSettings): boolean {
  return Boolean(settings.supabaseUrl.trim() && settings.supabaseAnonKey.trim());
}

export function canUseJournalStorage(settings: ReactSettings): boolean {
  return settings.journalStorageEnabled && hasSupabaseConnectionSettings(settings) && Boolean(getJournalAccessToken(settings));
}

export function canUseRealFootballData(settings: ReactSettings): boolean {
  return !settings.mockMode && hasSupabaseConnectionSettings(settings) && Boolean(getFootballDataAccessToken(settings));
}

export function sendTelegramTestMessage(settings: ReactSettings): TelegramTestResult {
  return {
    ok: true,
    mode: "mock",
    channel: settings.telegramChannel.trim() || "канал не указан",
    message: "Тестовое аналитическое уведомление подготовлено.",
    createdAt: new Date().toISOString()
  };
}

export async function sendJournalSyncTest(settings: ReactSettings, history: PatternEvent[]): Promise<JournalSyncTestResult> {
  if (!settings.journalStorageEnabled) {
    return journalSyncResult(false, "mock", "Постоянный журнал выключен.", 0, 0);
  }

  const supabaseUrl = settings.supabaseUrl.trim();
  const anonKey = settings.supabaseAnonKey.trim();
  const accessToken = getJournalAccessToken(settings);

  if (!supabaseUrl || !anonKey) {
    return journalSyncResult(false, "supabase", "Укажите Supabase URL и anon key.", 0, 0);
  }

  if (!accessToken) {
    return journalSyncResult(false, "supabase", "Укажите Journal access token.", 0, 0);
  }

  if (!history.length) {
    return journalSyncResult(false, "supabase", "В истории пока нет событий для отправки.", 0, 0);
  }

  const client = new JournalIngestClient({ supabaseUrl, anonKey, accessToken });
  const events = history.slice(0, 20);
  const patternStats = buildPatternStatsDaily(history);
  const response = await client.send({
    events,
    patternStats,
    ingestionRun: {
      provider: "manual-settings-test",
      status: "success",
      signalsCreated: events.length,
      message: "Ручная проверка записи журнала из настроек.",
      finishedAt: new Date().toISOString()
    }
  });

  return journalSyncResult(
    true,
    "supabase",
    "Проверка журнала выполнена.",
    response.signalsSaved,
    response.patternStatsSaved
  );
}

export async function sendFootballDataTest(settings: ReactSettings): Promise<FootballDataTestResult> {
  const supabaseUrl = settings.supabaseUrl.trim();
  const anonKey = settings.supabaseAnonKey.trim();
  const functionName = settings.footballDataFunctionName.trim() || "football-live";
  const accessToken = getFootballDataAccessToken(settings);

  if (!supabaseUrl || !anonKey) {
    return footballDataTestResult(false, "not_configured", "Укажите Supabase URL и anon key.", 0, false);
  }

  if (!accessToken) {
    return footballDataTestResult(false, "not_configured", "Укажите Data access token или Journal access token.", 0, false);
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      ...(accessToken ? { "x-live-scanner-key": accessToken } : {}),
      "content-type": "application/json"
    },
    body: JSON.stringify({ scope: "live-snapshot" })
  });

  if (!response.ok) {
    return footballDataTestResult(false, functionName, `Ошибка проверки источника: ${await response.text()}`, 0, false);
  }

  const payload = await response.json() as {
    ok?: boolean;
    provider?: string;
    message?: string;
    cached?: boolean;
    data?: {
      matches?: unknown[];
    };
  };

  return footballDataTestResult(
    Boolean(payload.ok),
    payload.provider || functionName,
    payload.message || "Источник ответил.",
    payload.data?.matches?.length || 0,
    Boolean(payload.cached)
  );
}

function journalSyncResult(
  ok: boolean,
  mode: JournalSyncTestResult["mode"],
  message: string,
  signalsSaved: number,
  patternStatsSaved: number
): JournalSyncTestResult {
  return {
    ok,
    mode,
    message,
    signalsSaved,
    patternStatsSaved,
    createdAt: new Date().toISOString()
  };
}

function footballDataTestResult(
  ok: boolean,
  provider: string,
  message: string,
  matchesLoaded: number,
  cached: boolean
): FootballDataTestResult {
  return {
    ok,
    provider,
    message,
    matchesLoaded,
    cached,
    createdAt: new Date().toISOString()
  };
}
