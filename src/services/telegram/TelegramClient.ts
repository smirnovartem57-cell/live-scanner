import type { PatternEvent, Signal } from "../../types/patterns";

export type TelegramClientConfig = { supabaseUrl: string; anonKey: string; accessToken: string; functionName?: string };
export type TelegramSendResult = { ok: boolean; mode: "telegram"; channel: string; message: string; createdAt: string };

export class TelegramClient {
  private readonly functionName: string;
  constructor(private readonly config: TelegramClientConfig) { this.functionName = config.functionName || "telegram-send"; }
  sendTest(channel: string) { return this.send({ kind: "test", channel }); }
  sendSignal(channel: string, signal: Signal | PatternEvent) { return this.send({ kind: "signal", channel, signal }); }

  private async send(payload: unknown): Promise<TelegramSendResult> {
    const response = await fetch(`${this.config.supabaseUrl.trim()}/functions/v1/${this.functionName}`, {
      method: "POST",
      headers: {
        apikey: this.config.anonKey.trim(), authorization: `Bearer ${this.config.anonKey.trim()}`,
        "x-live-scanner-key": this.config.accessToken.trim(), "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Telegram send failed: ${await response.text()}`);
    return await response.json() as TelegramSendResult;
  }
}
