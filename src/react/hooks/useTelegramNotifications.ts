import { useEffect } from "react";
import { TelegramClient } from "../../services/telegram";
import type { Signal } from "../../types/patterns";
import { canUseTelegram, getTelegramAccessToken, type ReactSettings } from "../domain/settings";

const sentSignalsKey = "football-pattern-lab-telegram-sent-signals";

export function useTelegramNotifications(settings: ReactSettings, signals: Signal[]) {
  useEffect(() => {
    if (!canUseTelegram(settings) || !signals.length) return;
    const sentIds = readSentIds();
    const pending = signals.filter((signal) => !sentIds.has(signal.id));
    if (!pending.length) return;
    let cancelled = false;
    const client = new TelegramClient({
      supabaseUrl: settings.supabaseUrl, anonKey: settings.supabaseAnonKey,
      accessToken: getTelegramAccessToken(settings), functionName: settings.telegramFunctionName
    });
    async function sendPending() {
      for (const signal of pending) {
        await client.sendSignal(settings.telegramChannel.trim(), signal);
        if (cancelled) return;
        rememberSentId(signal.id);
      }
    }
    sendPending().catch((error) => console.warn("Telegram notification failed", error));
    return () => { cancelled = true; };
  }, [settings, signals]);
}

function readSentIds() {
  try { return new Set<string>(JSON.parse(localStorage.getItem(sentSignalsKey) || "[]")); }
  catch { return new Set<string>(); }
}
function rememberSentId(id: string) {
  const ids = readSentIds(); ids.add(id);
  localStorage.setItem(sentSignalsKey, JSON.stringify([...ids].slice(-500)));
}
