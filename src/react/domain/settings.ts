import { buildPatternStatsDaily, JournalIngestClient, JournalReadClient } from "../../services/journalStorage";
import { TelegramClient } from "../../services/telegram";
import type { Pattern, PatternConditionProfile, PatternEvent } from "../../types/patterns";

export type TelegramTestResult = {
  ok: boolean;
  mode: "telegram" | "mock";
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

export type JournalRoundtripTestResult = {
  ok: boolean;
  message: string;
  eventId: string;
  signalsSaved: number;
  foundAfterRead: boolean;
  createdAt: string;
};

export type FootballDataTestResult = {
  ok: boolean;
  provider: string;
  message: string;
  matchesLoaded: number;
  snapshotsLoaded: number;
  eventMatchesLoaded: number;
  teamProfilesLoaded: number;
  cached: boolean;
  createdAt: string;
};

export type ReactSettings = {
  mockMode: boolean;
  telegramEnabled: boolean;
  telegramChannel: string;
  telegramFunctionName: string;
  telegramAccessToken: string;
  socialDataFunctionName: string;
  socialDataAccessToken: string;
  journalStorageEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  journalAccessToken: string;
  footballDataFunctionName: string;
  footballDataAccessToken: string;
  patternRuleOverrides: Record<string, Array<{ value: number | string }>>;
  patternEnabledOverrides: Record<string, boolean>;
  patternConditionProfiles: PatternConditionProfile[];
  favoriteLeagues: string[];
  lastTelegramTest: TelegramTestResult | null;
  lastJournalSync: JournalSyncTestResult | null;
  lastJournalRoundtrip: JournalRoundtripTestResult | null;
  lastFootballDataTest: FootballDataTestResult | null;
};

const settingsKey = "football-pattern-lab-settings";
const defaultSupabaseUrl = "https://bvhamsuzuqdajoibuaig.supabase.co";
const defaultSupabaseAnonKey = "sb_publishable___RMv9rrvDsDZSGvS_462g_gJ1pw6HG";

export const defaultReactSettings: ReactSettings = {
  mockMode: true,
  telegramEnabled: false,
  telegramChannel: "",
  telegramFunctionName: "telegram-send",
  telegramAccessToken: "",
  socialDataFunctionName: "social-data",
  socialDataAccessToken: "",
  journalStorageEnabled: false,
  supabaseUrl: defaultSupabaseUrl,
  supabaseAnonKey: defaultSupabaseAnonKey,
  journalAccessToken: "",
  footballDataFunctionName: "football-live",
  footballDataAccessToken: "",
  patternRuleOverrides: {},
  patternEnabledOverrides: {},
  patternConditionProfiles: [],
  favoriteLeagues: ["Spain LaLiga", "Italy Serie A", "Portugal Primeira"],
  lastTelegramTest: null,
  lastJournalSync: null,
  lastJournalRoundtrip: null,
  lastFootballDataTest: null
};

export function readReactSettings(): ReactSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(settingsKey) || "null") as Partial<ReactSettings> | null;
    const settings = { ...defaultReactSettings, ...(stored || {}) };
    return {
      ...settings,
      supabaseUrl: settings.supabaseUrl.trim() || defaultSupabaseUrl,
      supabaseAnonKey: settings.supabaseAnonKey.trim() || defaultSupabaseAnonKey
    };
  } catch {
    return defaultReactSettings;
  }
}

export function writeReactSettings(settings: ReactSettings) {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

export function applyPatternSettings(
  patterns: Pattern[],
  ruleOverrides: ReactSettings["patternRuleOverrides"],
  enabledOverrides: ReactSettings["patternEnabledOverrides"]
): Pattern[] {
  return patterns.map((pattern) => {
    const patternOverrides = ruleOverrides[pattern.id];
    const enabledOverride = enabledOverrides[pattern.id];

    return {
      ...pattern,
      enabled: enabledOverride ?? pattern.enabled,
      rules: pattern.rules.map((rule, index) => ({
        ...rule,
        value: patternOverrides?.[index]?.value ?? rule.value
      }))
    };
  });
}

export function getJournalAccessToken(settings: ReactSettings): string {
  return settings.journalAccessToken.trim();
}

export function getFootballDataAccessToken(settings: ReactSettings): string {
  return (settings.footballDataAccessToken || settings.journalAccessToken).trim();
}

export function getTelegramAccessToken(settings: ReactSettings): string {
  return (settings.telegramAccessToken || settings.journalAccessToken).trim();
}

export function getSocialDataAccessToken(settings: ReactSettings): string {
  return (settings.socialDataAccessToken || settings.journalAccessToken).trim();
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

export function canUseTelegram(settings: ReactSettings): boolean {
  return settings.telegramEnabled && hasSupabaseConnectionSettings(settings) &&
    Boolean(settings.telegramChannel.trim() && getTelegramAccessToken(settings));
}

export function sendTelegramMockTestMessage(settings: ReactSettings): TelegramTestResult {
  return {
    ok: true,
    mode: "mock",
    channel: settings.telegramChannel.trim() || "канал не указан",
    message: "Тестовое аналитическое уведомление подготовлено.",
    createdAt: new Date().toISOString()
  };
}

export async function sendTelegramTestMessage(settings: ReactSettings): Promise<TelegramTestResult> {
  if (!hasSupabaseConnectionSettings(settings)) throw new Error("Укажите Supabase URL и anon key.");
  if (!settings.telegramChannel.trim()) throw new Error("Укажите Telegram-канал или chat id.");
  const accessToken = getTelegramAccessToken(settings);
  if (!accessToken) throw new Error("Укажите Telegram access token или Journal access token.");
  return await new TelegramClient({
    supabaseUrl: settings.supabaseUrl,
    anonKey: settings.supabaseAnonKey,
    accessToken,
    functionName: settings.telegramFunctionName
  }).sendTest(settings.telegramChannel.trim());
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

export async function sendJournalRoundtripTest(settings: ReactSettings): Promise<JournalRoundtripTestResult> {
  const supabaseUrl = settings.supabaseUrl.trim();
  const anonKey = settings.supabaseAnonKey.trim();
  const accessToken = getJournalAccessToken(settings);
  const createdAt = new Date().toISOString();
  const event = buildDiagnosticJournalEvent(createdAt);

  if (!settings.journalStorageEnabled) {
    return journalRoundtripResult(false, "Постоянный журнал выключен.", event.id, 0, false);
  }

  if (!supabaseUrl || !anonKey) {
    return journalRoundtripResult(false, "Укажите Supabase URL и anon key.", event.id, 0, false);
  }

  if (!accessToken) {
    return journalRoundtripResult(false, "Укажите Journal access token.", event.id, 0, false);
  }

  const ingestClient = new JournalIngestClient({ supabaseUrl, anonKey, accessToken });
  const ingestResult = await ingestClient.send({
    events: [event],
    patternStats: buildPatternStatsDaily([event]),
    ingestionRun: {
      provider: "journal-roundtrip-test",
      status: "success",
      signalsCreated: 1,
      message: "Проверка полного круга журнала: запись и чтение.",
      finishedAt: createdAt
    }
  });

  const readClient = new JournalReadClient({ supabaseUrl, anonKey, accessToken });
  const readResult = await readClient.read({ limit: 50, includePatternStats: true, patternStatsDays: 1, includeDiagnostics: true });
  const foundAfterRead = readResult.history.some((item) => item.id === event.id);

  return journalRoundtripResult(
    foundAfterRead,
    foundAfterRead ? "Полный круг журнала работает: событие записано и прочитано обратно." : "Запись прошла, но событие не найдено при чтении журнала.",
    event.id,
    ingestResult.signalsSaved,
    foundAfterRead
  );
}

export async function sendFootballDataTest(settings: ReactSettings): Promise<FootballDataTestResult> {
  const supabaseUrl = settings.supabaseUrl.trim();
  const anonKey = settings.supabaseAnonKey.trim();
  const functionName = settings.footballDataFunctionName.trim() || "football-live";
  const accessToken = getFootballDataAccessToken(settings);

  if (!supabaseUrl || !anonKey) {
    return footballDataTestResult(false, "not_configured", "Укажите Supabase URL и anon key.", 0, 0, 0, 0, false);
  }

  if (!accessToken) {
    return footballDataTestResult(false, "not_configured", "Укажите Data access token или Journal access token.", 0, 0, 0, 0, false);
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
    return footballDataTestResult(false, functionName, `Ошибка проверки источника: ${await response.text()}`, 0, 0, 0, 0, false);
  }

  const payload = await response.json() as {
    ok?: boolean;
    provider?: string;
    message?: string;
    cached?: boolean;
    data?: {
      matches?: unknown[];
      snapshots?: unknown[];
      events?: Record<string, unknown[]>;
      teamProfiles?: unknown[];
    };
  };
  const eventMatchesLoaded = Object.values(payload.data?.events || {}).filter((items) => Array.isArray(items) && items.length > 0).length;

  return footballDataTestResult(
    Boolean(payload.ok),
    payload.provider || functionName,
    payload.message || "Источник ответил.",
    payload.data?.matches?.length || 0,
    payload.data?.snapshots?.length || 0,
    eventMatchesLoaded,
    payload.data?.teamProfiles?.length || 0,
    Boolean(payload.cached)
  );
}

function buildDiagnosticJournalEvent(createdAt: string): PatternEvent {
  return {
    id: `diagnostic-${Date.now()}`,
    matchId: "diagnostic-match",
    match: "Diagnostic Home - Diagnostic Away",
    league: "System Check",
    patternId: "diagnostic_roundtrip",
    patternType: "diagnostic_roundtrip",
    teamId: "diagnostic-home",
    teamSide: "home",
    minute: 1,
    scoreHome: 0,
    scoreAway: 0,
    score: "0:0",
    pressureScore: 1,
    strength: "LOW",
    status: "success",
    signalKind: "signal",
    statsAtSignal: {
      attacks: 1,
      dangerousAttacks: 1,
      shotsTotal: 0,
      shotsOnTarget: 0,
      corners: 0
    },
    explanation: "Диагностическое событие для проверки записи и чтения постоянного журнала.",
    comment: "Создано кнопкой проверки полного круга.",
    createdAt,
    updatedAt: createdAt,
    result: {
      goalWithin5: false,
      goalWithin10: false,
      goalWithin15: false,
      goalMinute: null,
      goalTeam: null,
      finalComment: "Диагностическая запись успешно закрыта.",
      manualOutcome: "win"
    },
    resultSource: "manual",
    closedAt: createdAt
  };
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
  snapshotsLoaded: number,
  eventMatchesLoaded: number,
  teamProfilesLoaded: number,
  cached: boolean
): FootballDataTestResult {
  return {
    ok,
    provider,
    message,
    matchesLoaded,
    snapshotsLoaded,
    eventMatchesLoaded,
    teamProfilesLoaded,
    cached,
    createdAt: new Date().toISOString()
  };
}

function journalRoundtripResult(
  ok: boolean,
  message: string,
  eventId: string,
  signalsSaved: number,
  foundAfterRead: boolean
): JournalRoundtripTestResult {
  return {
    ok,
    message,
    eventId,
    signalsSaved,
    foundAfterRead,
    createdAt: new Date().toISOString()
  };
}
