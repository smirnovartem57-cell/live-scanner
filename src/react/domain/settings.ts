import { JournalIngestClient, type PatternStatsDaily } from "../../services/journalStorage";
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

function buildPatternStatsDaily(history: PatternEvent[]): PatternStatsDaily[] {
  const groups = new Map<string, PatternEvent[]>();

  for (const event of history) {
    const statDate = event.createdAt.slice(0, 10);
    const key = `${statDate}:${event.patternId}`;
    groups.set(key, [...(groups.get(key) || []), event]);
  }

  return [...groups.entries()].map(([key, events]) => {
    const [statDate] = key.split(":");
    const failedSignals = events.filter((event) => event.status === "failed" || event.result.manualOutcome === "lose").length;
    const closedSignals = events.filter((event) => ["success", "failed"].includes(event.status) || event.result.manualOutcome).length;
    const successWithin15 = events.filter((event) => event.result.goalWithin15 || event.result.manualOutcome === "win").length;

    return {
      statDate,
      patternId: events[0].patternId,
      patternType: events[0].patternType,
      totalSignals: events.length,
      successWithin5: events.filter((event) => event.result.goalWithin5).length,
      successWithin10: events.filter((event) => event.result.goalWithin10).length,
      successWithin15,
      failedSignals,
      warningSignals: events.filter((event) => event.signalKind === "warning").length,
      averagePressureScore: average(events.map((event) => event.pressureScore)),
      averageMinute: average(events.map((event) => event.minute)),
      qualityScore: closedSignals ? Math.round((successWithin15 / closedSignals) * 100) : 0
    };
  });
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
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
