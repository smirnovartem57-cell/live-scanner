(function () {
  const keys = {
    serviceMeta: "football-pattern-lab-service-meta",
    patternEvents: "football-pattern-lab-pattern-events",
    patternSettings: "football-pattern-lab-pattern-settings",
    patternProfiles: "football-pattern-lab-pattern-profiles",
    teamNotes: "football-pattern-lab-team-notes",
    settings: "football-pattern-lab-settings"
  };

  const defaultSettings = {
    mockMode: true,
    telegramEnabled: false,
    telegramChannel: "",
    lastTelegramTest: null,
    favoriteLeagues: ["Spain LaLiga", "Italy Serie A", "Portugal Primeira"]
  };

  function readJson(key, fallback) {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      return stored ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readServiceMeta() {
    const fallback = { startedAt: new Date().toISOString() };
    const stored = readJson(keys.serviceMeta, null);
    if (stored?.startedAt) {
      return stored;
    }
    writeJson(keys.serviceMeta, fallback);
    return fallback;
  }

  function readSettings() {
    return { ...defaultSettings, ...readJson(keys.settings, {}) };
  }

  window.LiveScannerStorage = {
    keys,
    readJson,
    writeJson,
    readServiceMeta,
    readSettings,
    readPatternEvents: () => readJson(keys.patternEvents, null),
    writePatternEvents: (events) => writeJson(keys.patternEvents, events),
    readPatternSettings: () => readJson(keys.patternSettings, {}),
    writePatternSettings: (settings) => writeJson(keys.patternSettings, settings),
    readPatternProfiles: () => readJson(keys.patternProfiles, []),
    writePatternProfiles: (profiles) => writeJson(keys.patternProfiles, profiles),
    readTeamNotes: () => readJson(keys.teamNotes, {}),
    writeTeamNotes: (notes) => writeJson(keys.teamNotes, notes),
    writeSettings: (settings) => writeJson(keys.settings, settings)
  };
})();
