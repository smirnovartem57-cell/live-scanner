(function () {
  function updateSetting(settings, key, value) {
    return {
      ...settings,
      [key]: value
    };
  }

  function updateTelegramTestResult(settings, result) {
    return updateSetting(settings, "lastTelegramTest", result);
  }

  function getTelegramStatus(settings, formatDateTime, escapeHtml) {
    const result = settings.lastTelegramTest;
    if (!result) return "";

    return `<p class="telegram-status">${escapeHtml(result.message)}<span>${escapeHtml(result.channel)} · ${formatDateTime(result.createdAt)}</span></p>`;
  }

  window.LiveScannerSettings = {
    getTelegramStatus,
    updateSetting,
    updateTelegramTestResult
  };
})();
