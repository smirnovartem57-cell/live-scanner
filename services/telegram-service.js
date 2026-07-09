function createTelegramService() {
  function getChannelLabel(settings = {}) {
    return settings.telegramChannel?.trim() || "канал не указан";
  }

  function buildSignalMessage(signal) {
    const matchLabel = signal.matchLabel || signal.match || signal.matchId || "Матч без названия";
    const patternLabel = signal.patternName || signal.patternType || "Аналитический сигнал";
    const minute = signal.minute ? `${signal.minute}'` : "минута не указана";
    const score = signal.score ? `Счет: ${signal.score}` : "";
    const pressure = Number.isFinite(signal.pressureScore)
      ? `Pressure score: ${signal.pressureScore}`
      : "";

    return [
      "Football Pattern Lab",
      `Сигнал: ${patternLabel}`,
      `Матч: ${matchLabel}`,
      `Минута: ${minute}`,
      score,
      pressure,
      signal.explanation || signal.summary || ""
    ].filter(Boolean).join("\n");
  }

  async function sendTelegramTestMessage(settings = {}) {
    return {
      ok: true,
      mode: "mock",
      channel: getChannelLabel(settings),
      message: "Тестовое аналитическое уведомление подготовлено.",
      createdAt: new Date().toISOString()
    };
  }

  async function sendSignalToTelegram(signal, settings = {}) {
    return {
      ok: true,
      mode: "mock",
      channel: getChannelLabel(settings),
      message: buildSignalMessage(signal),
      createdAt: new Date().toISOString()
    };
  }

  return {
    buildSignalMessage,
    sendTelegramTestMessage,
    sendSignalToTelegram
  };
}

window.FootballTelegramService = {
  createTelegramService
};
