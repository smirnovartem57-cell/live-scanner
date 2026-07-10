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

export type ReactSettings = {
  mockMode: boolean;
  telegramEnabled: boolean;
  telegramChannel: string;
  journalStorageEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  favoriteLeagues: string[];
  lastTelegramTest: TelegramTestResult | null;
  lastJournalSync: JournalSyncTestResult | null;
};

const settingsKey = "football-pattern-lab-settings";

export const defaultReactSettings: ReactSettings = {
  mockMode: true,
  telegramEnabled: false,
  telegramChannel: "",
  journalStorageEnabled: false,
  supabaseUrl: "",
  supabaseAnonKey: "",
  favoriteLeagues: ["Spain LaLiga", "Italy Serie A", "Portugal Primeira"],
  lastTelegramTest: null,
  lastJournalSync: null
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

  if (!supabaseUrl || !anonKey) {
    return journalSyncResult(false, "supabase", "Укажите Supabase URL и anon key.", 0, 0);
  }

  if (!history.length) {
    return journalSyncResult(false, "supabase", "В истории пока нет событий для отправки.", 0, 0);
  }

  const client = new JournalIngestClient({ supabaseUrl, anonKey });
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
