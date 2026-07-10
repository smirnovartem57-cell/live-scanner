export type TelegramTestResult = {
  ok: boolean;
  mode: "mock";
  channel: string;
  message: string;
  createdAt: string;
};

export type ReactSettings = {
  mockMode: boolean;
  telegramEnabled: boolean;
  telegramChannel: string;
  favoriteLeagues: string[];
  lastTelegramTest: TelegramTestResult | null;
};

const settingsKey = "football-pattern-lab-settings";

export const defaultReactSettings: ReactSettings = {
  mockMode: true,
  telegramEnabled: false,
  telegramChannel: "",
  favoriteLeagues: ["Spain LaLiga", "Italy Serie A", "Portugal Primeira"],
  lastTelegramTest: null
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
