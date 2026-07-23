type TelegramPayload = { kind?: "test" | "signal"; channel?: string; signal?: {
  match?: string; matchId?: string; patternType?: string; minute?: number; score?: string;
  scoreHome?: number; scoreAway?: number; pressureScore?: number; strength?: string; explanation?: string;
} };
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-live-scanner-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!hasAccess(request)) return json({ error: "Access denied" }, 403);
  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return json({ error: "Telegram bot is not configured" }, 500);
    const payload = await request.json() as TelegramPayload;
    const channel = payload.channel?.trim();
    if (!channel || channel.length > 128) return json({ error: "Valid Telegram channel or chat id is required" }, 400);
    const text = payload.kind === "signal" ? buildSignalMessage(payload.signal) : "Live Scanner\nТестовое уведомление успешно настроено.";
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: channel, text, disable_web_page_preview: true })
    });
    const result = await response.json() as { ok?: boolean; description?: string };
    if (!response.ok || !result.ok) return json({ error: result.description || "Telegram API rejected the message" }, 502);
    return json({ ok: true, mode: "telegram", channel,
      message: payload.kind === "signal" ? "Сигнал отправлен в Telegram." : "Тестовое сообщение отправлено в Telegram.",
      createdAt: new Date().toISOString() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Telegram send failed" }, 500);
  }
});

function hasAccess(request: Request) {
  const expected = Deno.env.get("TELEGRAM_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expected) && request.headers.get("x-live-scanner-key") === expected;
}
function buildSignalMessage(signal: TelegramPayload["signal"] = {}) {
  const score = signal.score || (Number.isFinite(signal.scoreHome) && Number.isFinite(signal.scoreAway)
    ? `${signal.scoreHome}:${signal.scoreAway}` : "—");
  return ["Live Scanner · новый сигнал", `Матч: ${signal.match || signal.matchId || "—"}`,
    `Паттерн: ${signal.patternType || "—"}`, `Минута: ${Number.isFinite(signal.minute) ? `${signal.minute}'` : "—"}`,
    `Счёт: ${score}`, `Pressure: ${Number.isFinite(signal.pressureScore) ? signal.pressureScore : "—"}`,
    `Сила: ${signal.strength || "—"}`, signal.explanation || ""].filter(Boolean).join("\n").slice(0, 4096);
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
}
