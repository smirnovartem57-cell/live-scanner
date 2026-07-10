const footballProvider = window.FootballDataProvider.createFootballProvider("mock");
const patternEngine = window.FootballPatternEngine;
const signalResultEngine = window.FootballSignalResultEngine;
const telegramService = window.FootballTelegramService.createTelegramService();
const storage = window.LiveScannerStorage;
const historyService = window.LiveScannerHistoryService;
const patternAnalytics = window.LiveScannerPatternAnalytics;
const teamProfileService = window.LiveScannerTeamProfile;
const settingsService = window.LiveScannerSettings;
const socialFeedback = window.LiveScannerSocialFeedback;
const {
  formatOutcome,
  formatResultSource,
  getOutcome
} = historyService;
const {
  escapeHtml,
  feedbackPriorityLabel,
  feedbackStatusLabel,
  feedbackTypeLabel,
  formatDate,
  formatDateTime,
  formatImportance,
  formatMatchResult,
  formatResult,
  formatTeamPatternLabel,
  profilePermissionLabel
} = window.LiveScannerFormatters;

const navItems = [
  { id: "live", label: "Матчи", title: "Сканер матчей" },
  { id: "signals", label: "Сигналы", title: "Активные сигналы" },
  { id: "patterns", label: "Паттерны", title: "Лаборатория паттернов" },
  { id: "history", label: "История", title: "История паттернов" },
  { id: "stats", label: "Статистика", title: "Статистика" },
  { id: "profile", label: "Профиль", title: "Профиль аналитика" },
  { id: "ideas", label: "Идеи", title: "Идеи и обратная связь" },
  { id: "settings", label: "Настройки", title: "Настройки" }
];

const state = {
  view: "live",
  activeFilter: "all",
  historyFilter: "all",
  statsPeriod: "all",
  patternSort: "quality",
  activePatternId: "pressure_without_goal",
  settings: readSettings(),
  patternSettings: readPatternSettings(),
  patternProfiles: readPatternProfiles(),
  patternProfileDraftName: "",
  teamNotes: readTeamNotes(),
  patterns: [],
  matches: [],
  snapshots: [],
  matchEvents: {},
  signals: [],
  history: [],
  userProfile: null,
  feedbackItems: [],
  selectedTeam: null,
  serviceMeta: readServiceMeta()
};

const root = document.querySelector("#pageRoot");
const title = document.querySelector("#pageTitle");
const desktopNav = document.querySelector("#desktopNav");
const mobileNav = document.querySelector("#mobileNav");
const refreshButton = document.querySelector("#refreshButton");
const profileButton = document.querySelector("#profileButton");

const patternTypeLabels = {
  pressure_without_goal: "Давят без гола",
  late_goal: "Поздний гол",
  favorite_losing_but_pressing: "Проигрывает, но давит",
  match_woke_up: "Матч ожил",
  corner_pressure: "Давление на угловой",
  empty_pressure: "Пустое давление"
};

const statusLabels = {
  new: "Новый",
  in_progress: "В процессе",
  success: "Сработал",
  failed: "Не сработал"
};

const strengthLabels = {
  LOW: "Низкий",
  MED: "Средний",
  HIGH: "Сильный"
};

const patternStatusLabels = {
  new: "Новый",
  promising: "Перспективный",
  working: "Рабочий",
  weak: "Слабый",
  ineffective: "Неэффективный",
  testing: "Тестируется"
};

function init() {
  state.patterns = footballProvider.getPatterns();
  state.matches = footballProvider.getLiveMatches();
  state.snapshots = footballProvider.getMatchStats();
  state.matchEvents = footballProvider.getMatchEvents();
  state.history = readPatternEvents(footballProvider.getSeedHistory());
  state.userProfile = footballProvider.getUserProfile?.();
  state.feedbackItems = footballProvider.getFeedbackItems?.() || [];
  state.signals = evaluateCurrentMatches();
  syncActiveSignalsToJournal();
  syncSignalResults();

  bindNavigation();
  refreshButton.addEventListener("click", refreshMockData);
  profileButton.addEventListener("click", () => {
    state.view = "profile";
    render();
  });
  render();
}

function bindNavigation() {
  const navHtml = navItems.map((item) => `
    <button class="nav-item" type="button" data-view="${item.id}" aria-label="${item.label}">
      <span>${item.label}</span>
    </button>
  `).join("");

  desktopNav.innerHTML = navHtml;
  mobileNav.innerHTML = navItems.slice(0, 5).map((item) => `
    <button class="nav-item" type="button" data-view="${item.id}" aria-label="${item.label}">
      <span>${item.label}</span>
    </button>
  `).join("");

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    });
  });
}

function render() {
  const navItem = navItems.find((item) => item.id === state.view);
  title.textContent = navItem.title;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });

  const views = {
    live: renderLive,
    signals: renderSignals,
    patterns: renderPatterns,
    history: renderHistory,
    stats: renderStats,
    profile: renderProfile,
    ideas: renderIdeas,
    settings: renderSettings
  };

  root.innerHTML = views[state.view]();
  bindPageEvents();
}

function bindPageEvents() {
  root.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      render();
    });
  });

  root.querySelectorAll("[data-history-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.historyFilter = button.dataset.historyFilter;
      render();
    });
  });

  root.querySelectorAll("[data-stats-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.statsPeriod = button.dataset.statsPeriod;
      render();
    });
  });

  root.querySelectorAll("[data-pattern-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      state.patternSort = button.dataset.patternSort;
      render();
    });
  });

  root.querySelectorAll("[data-close-event]").forEach((button) => {
    button.addEventListener("click", () => {
      closePatternEvent(button.dataset.closeEvent, button.dataset.outcome);
      render();
    });
  });

  root.querySelectorAll("[data-comment-event]").forEach((input) => {
    input.addEventListener("input", () => {
      updatePatternEvent(input.dataset.commentEvent, {
        comment: input.value,
        result: { finalComment: input.value }
      });
    });
  });

  root.querySelectorAll("[data-export-history]").forEach((button) => {
    button.addEventListener("click", () => {
      exportHistory(button.dataset.exportHistory);
    });
  });

  root.querySelectorAll("[data-team-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTeam = {
        matchId: button.dataset.matchId,
        teamId: button.dataset.teamId,
        side: button.dataset.teamSide,
        name: button.dataset.teamProfile
      };
      render();
    });
  });

  root.querySelectorAll("[data-close-team-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTeam = null;
      render();
    });
  });

  root.querySelectorAll("[data-team-note]").forEach((input) => {
    input.addEventListener("input", () => {
      updateTeamNote(input.dataset.teamNote, { note: input.value });
    });
  });

  root.querySelectorAll("[data-team-tags]").forEach((input) => {
    input.addEventListener("input", () => {
      updateTeamNote(input.dataset.teamTags, {
        tags: input.value.split(",").map((tag) => tag.trim()).filter(Boolean)
      });
    });
  });

  root.querySelectorAll("[data-team-important]").forEach((input) => {
    input.addEventListener("change", () => {
      updateTeamNote(input.dataset.teamImportant, { importantMatch: input.checked });
    });
  });

  root.querySelectorAll("[data-save-team-note]").forEach((button) => {
    button.addEventListener("click", () => {
      saveTeamNoteSnapshot(button.dataset.saveTeamNote);
      render();
    });
  });

  root.querySelectorAll("[data-pattern-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activePatternId = button.dataset.patternId;
      render();
    });
  });

  root.querySelectorAll("[data-toggle-pattern]").forEach((input) => {
    input.addEventListener("change", () => {
      const pattern = state.patterns.find((item) => item.id === input.dataset.togglePattern);
      pattern.enabled = input.checked;
      state.signals = evaluateCurrentMatches();
      render();
    });
  });

  root.querySelectorAll("[data-rule-setting]").forEach((input) => {
    input.addEventListener("input", () => {
      updatePatternRuleSetting(input.dataset.rulePattern, Number(input.dataset.ruleIndex), input.value);
    });
  });

  root.querySelectorAll("[data-reset-pattern-settings]").forEach((button) => {
    button.addEventListener("click", () => {
      delete state.patternSettings[button.dataset.resetPatternSettings];
      writePatternSettings();
      state.signals = evaluateCurrentMatches();
      syncActiveSignalsToJournal();
      syncSignalResults();
      render();
    });
  });

  const profileNameInput = root.querySelector("#patternProfileName");
  if (profileNameInput) {
    profileNameInput.addEventListener("input", () => {
      state.patternProfileDraftName = profileNameInput.value;
    });
  }

  root.querySelectorAll("[data-save-pattern-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      savePatternProfile(button.dataset.savePatternProfile);
      render();
    });
  });

  root.querySelectorAll("[data-apply-pattern-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      applyPatternProfile(button.dataset.applyPatternProfile);
      render();
    });
  });

  root.querySelectorAll("[data-export-pattern-profiles]").forEach((button) => {
    button.addEventListener("click", exportPatternProfiles);
  });

  const importProfiles = root.querySelector("#importPatternProfiles");
  if (importProfiles) {
    importProfiles.addEventListener("change", () => {
      importPatternProfiles(importProfiles);
    });
  }

  const telegramToggle = root.querySelector("#telegramEnabled");
  if (telegramToggle) {
    telegramToggle.addEventListener("change", () => {
      state.settings = settingsService.updateSetting(state.settings, "telegramEnabled", telegramToggle.checked);
      writeSettings();
      render();
    });
  }

  const telegramChannel = root.querySelector("#telegramChannel");
  if (telegramChannel) {
    telegramChannel.addEventListener("input", () => {
      state.settings = settingsService.updateSetting(state.settings, "telegramChannel", telegramChannel.value);
      writeSettings();
    });
  }

  const mockMode = root.querySelector("#mockMode");
  if (mockMode) {
    mockMode.addEventListener("change", () => {
      state.settings = settingsService.updateSetting(state.settings, "mockMode", mockMode.checked);
      writeSettings();
    });
  }

  const testTelegram = root.querySelector("#testTelegram");
  if (testTelegram) {
    testTelegram.addEventListener("click", async () => {
      testTelegram.disabled = true;
      testTelegram.textContent = "Готовим сообщение";
      const result = await telegramService.sendTelegramTestMessage(state.settings);
      state.settings = settingsService.updateTelegramTestResult(state.settings, result);
      writeSettings();
      render();
    });
  }
}

function renderLive() {
  const matches = getFilteredMatches();
  const stats = getDashboardStats();

  return `
    <section class="hero-strip">
      <div>
        <p class="eyebrow">${footballProvider.mode === "mock" ? "Демо-данные" : "Данные API"}</p>
        <h2>Сканер матчей по текущей статистике</h2>
      </div>
      <div class="refresh-note">Обновлено ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
    </section>

    ${renderSummary(stats)}
    ${renderFilterChips()}
    ${state.selectedTeam ? renderTeamProfile(state.selectedTeam) : ""}

    <section class="live-grid">
      <div class="match-feed">
        ${matches.map(renderMatchCard).join("") || renderEmpty("Под выбранный фильтр матчей нет.")}
      </div>
      <aside class="panel signal-feed">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Сигналы</p>
            <h2>Лента сигналов</h2>
          </div>
          <span class="count-pill">${state.signals.length}</span>
        </div>
        ${state.signals.slice(0, 5).map(renderCompactSignal).join("") || renderEmpty("Сигналов пока нет.")}
      </aside>
    </section>
  `;
}

function renderSignals() {
  return `
    <section class="section-grid">
      <div class="panel wide-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Активные</p>
            <h2>Найденные сигналы</h2>
          </div>
          <span class="count-pill">${state.signals.length}</span>
        </div>
        <div class="signal-table">
          ${state.signals.map(renderSignalRow).join("") || renderEmpty("Активных сигналов нет.")}
        </div>
      </div>
      <aside class="panel">
        <h2>Фильтры</h2>
        <div class="setting-stack">
          <span class="rule-chip">Тип паттерна</span>
          <span class="rule-chip">Сила сигнала</span>
          <span class="rule-chip">Минута</span>
          <span class="rule-chip">Лига</span>
          <span class="rule-chip">Статус</span>
        </div>
      </aside>
    </section>
  `;
}

function renderPatterns() {
  const activePattern = state.patterns.find((pattern) => pattern.id === state.activePatternId) || state.patterns[0];
  const stats = getPatternStats(activePattern, state.history);
  const customizedRules = getPatternRules(activePattern);
  const isCustomized = Boolean(state.patternSettings[activePattern.id]);

  return `
    <section class="pattern-layout">
      <aside class="panel pattern-list">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Паттерны</p>
            <h2>Паттерны</h2>
          </div>
        </div>
        ${state.patterns.map((pattern) => `
          <button class="pattern-list-item ${pattern.id === activePattern.id ? "is-active" : ""}" type="button" data-pattern-id="${pattern.id}">
            <span>${pattern.name}</span>
            <small>${pattern.enabled ? "Активен" : "Выключен"}</small>
          </button>
        `).join("")}
      </aside>

      <section class="panel builder-panel">
        <div class="builder-header">
          <div>
            <p class="eyebrow">Паттерны > ${activePattern.name}</p>
            <h2>Конструктор паттерна</h2>
          </div>
          <label class="switch">
            <input type="checkbox" data-toggle-pattern="${activePattern.id}" ${activePattern.enabled ? "checked" : ""}>
            <span>Активен</span>
          </label>
        </div>
        <p class="muted">${activePattern.description}</p>
        <div class="pattern-profile-note ${isCustomized ? "is-custom" : ""}">
          <strong>${isCustomized ? "Локальный профиль условий изменен" : "Базовый профиль условий"}</strong>
          <span>Пороговые значения сохраняются локально и сразу влияют на поиск сигналов в текущем браузере.</span>
        </div>
        <div class="threshold-list">
          ${customizedRules.map((rule, index) => renderThresholdControl(activePattern, rule, index)).join("")}
        </div>
        <div class="builder-actions">
          <button class="ghost-button" type="button" data-reset-pattern-settings="${activePattern.id}">Сбросить условия</button>
        </div>
        <div class="pattern-profile-manager">
          <label class="input-label">
            Название профиля условий
            <input id="patternProfileName" type="text" value="${escapeHtml(state.patternProfileDraftName)}" placeholder="Например: осторожный профиль">
          </label>
          <div class="builder-actions">
            <button class="ghost-button" type="button" data-save-pattern-profile="${activePattern.id}">Сохранить профиль</button>
            <button class="ghost-button" type="button" data-export-pattern-profiles>Экспорт JSON</button>
            <label class="ghost-button import-button">
              Импорт JSON
              <input id="importPatternProfiles" type="file" accept="application/json">
            </label>
          </div>
          ${renderPatternProfiles(activePattern)}
        </div>
      </section>

      <aside class="panel">
        <h2>Статистика паттерна</h2>
        <div class="mini-stats">
          ${metric("Срабатываний", stats.totalSignals)}
          ${metric("До 5 мин", stats.successWithin5)}
          ${metric("До 10 мин", stats.successWithin10)}
          ${metric("До 15 мин", stats.successWithin15)}
          ${metric("В процессе", stats.pendingSignals)}
          ${metric("Средняя минута", stats.averageSignalMinute)}
        </div>
        <div class="quality-note ${stats.status}">
          <strong>${patternStatusLabels[stats.status]}</strong>
          <span>${getPatternStatusReason(stats)}</span>
        </div>
        ${renderPatternAnalyticsDetails(stats)}
        <div class="sparkline" aria-hidden="true">
          <span style="height: 28%"></span><span style="height: 44%"></span><span style="height: 52%"></span><span style="height: 61%"></span><span style="height: 48%"></span><span style="height: 72%"></span>
        </div>
      </aside>
    </section>
  `;
}

function renderHistory() {
  const filteredHistory = getFilteredHistory();
  const journalStats = getJournalStats(state.history);
  const filteredStats = getJournalStats(filteredHistory);
  return `
    <section class="summary-grid journal-summary">
      ${metric("Сервис запущен", formatDate(journalStats.startedAt))}
      ${metric("Всего событий", journalStats.total)}
      ${metric("Win", journalStats.win)}
      ${metric("Lose", journalStats.lose)}
      ${metric("В процессе", journalStats.open)}
      ${metric("Win rate", `${journalStats.winRate}%`)}
    </section>

    <section class="panel wide-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Архив</p>
          <h2>История всех паттернов</h2>
        </div>
        <span class="count-pill">${filteredHistory.length}</span>
      </div>
      ${renderHistoryControls(filteredStats)}
      <div class="history-table">
        <div class="table-head">
          <span>Матч</span><span>Паттерн</span><span>Команда</span><span>Минута</span><span>Счет</span><span>Pressure</span><span>Статус</span><span>Источник</span><span>Детали</span><span>Комментарий</span><span>Действия</span>
        </div>
        ${filteredHistory.map((item) => `
          <div class="table-row ${item.signalKind === "warning" ? "is-warning" : ""}">
            <span><strong>${item.match}</strong><small>${item.league}</small></span>
            <span>${patternTypeLabels[item.patternType]}${item.signalKind === "warning" ? "<small class=\"warning-label\">Предупреждение</small>" : ""}</span>
            <span>${getEventTeamName(item)}</span>
            <span>${item.minute}'</span>
            <span>${item.score}</span>
            <span>${item.pressureScore || "—"}</span>
            <span><b class="status-dot ${item.status}"></b>${statusLabels[item.status]}<small>${formatResult(item)}</small></span>
            <span><b class="source-pill ${item.resultSource}">${formatResultSource(item)}</b></span>
            <span>${renderStatsAtSignal(item)}</span>
            <span>
              <textarea class="comment-field" data-comment-event="${item.id}" placeholder="Комментарий">${escapeHtml(item.comment || "")}</textarea>
            </span>
            <span class="event-actions">
              <button class="mini-action ${getOutcome(item) === "win" ? "is-win" : ""}" type="button" data-close-event="${item.id}" data-outcome="win">Win</button>
              <button class="mini-action ${getOutcome(item) === "lose" ? "is-lose" : ""}" type="button" data-close-event="${item.id}" data-outcome="lose">Lose</button>
            </span>
          </div>
        `).join("") || renderEmpty("Событий по этому фильтру нет.")}
      </div>
      <div class="history-card-list">
        ${filteredHistory.map(renderHistoryCard).join("") || renderEmpty("Событий по этому фильтру нет.")}
      </div>
    </section>
  `;
}

function renderHistoryControls(stats) {
  const filters = [
    ["all", "Все"],
    ["win", "Win"],
    ["lose", "Lose"],
    ["open", "В процессе"]
  ];

  return `
    <div class="history-toolbar">
      <div class="filter-chips compact">
        ${filters.map(([id, label]) => `
          <button class="chip ${state.historyFilter === id ? "is-active" : ""}" type="button" data-history-filter="${id}">${label}</button>
        `).join("")}
      </div>
      <div class="toolbar-stats">
        <span>В выборке: ${stats.total}</span>
        <span>Win: ${stats.win}</span>
        <span>Lose: ${stats.lose}</span>
        <span>Открыто: ${stats.open}</span>
      </div>
      <div class="export-actions">
        <button class="ghost-button" type="button" data-export-history="json">JSON</button>
        <button class="ghost-button" type="button" data-export-history="csv">CSV</button>
      </div>
    </div>
  `;
}

function renderStatsAtSignal(event) {
  const stats = event.statsAtSignal;
  if (!stats) {
    return "<small>Нет снимка</small>";
  }

  return `
    <details class="signal-details">
      <summary>Статистика</summary>
      <span>Опасные атаки <b>${stats.dangerousAttacks ?? "—"}</b></span>
      <span>Удары <b>${stats.shotsTotal ?? "—"}</b></span>
      <span>В створ <b>${stats.shotsOnTarget ?? "—"}</b></span>
      <span>Угловые <b>${stats.corners ?? "—"}</b></span>
      <span>xG <b>${typeof stats.xg === "number" ? stats.xg.toFixed(2) : "—"}</b></span>
    </details>
  `;
}

function renderHistoryCard(item) {
  return `
    <article class="history-card ${item.signalKind === "warning" ? "is-warning" : ""}">
      <div class="history-card-head">
        <div>
          <strong>${item.match}</strong>
          <span>${item.league} · ${getEventTeamName(item)}</span>
        </div>
        <b class="source-pill ${item.resultSource}">${formatResultSource(item)}</b>
      </div>
      <div class="history-card-pattern">
        <span>${patternTypeLabels[item.patternType]}</span>
        ${item.signalKind === "warning" ? "<small class=\"warning-label\">Предупреждение</small>" : ""}
      </div>
      <div class="history-card-metrics">
        <span><b>${item.minute}'</b>Минута</span>
        <span><b>${item.score}</b>Счет</span>
        <span><b>${item.pressureScore || "—"}</b>Индекс</span>
      </div>
      <div class="history-card-status">
        <span><b class="status-dot ${item.status}"></b>${statusLabels[item.status]}</span>
        <small>${formatResult(item)}</small>
      </div>
      ${renderStatsAtSignal(item)}
      <textarea class="comment-field" data-comment-event="${item.id}" placeholder="Комментарий">${escapeHtml(item.comment || "")}</textarea>
      <div class="event-actions">
        <button class="mini-action ${getOutcome(item) === "win" ? "is-win" : ""}" type="button" data-close-event="${item.id}" data-outcome="win">Win</button>
        <button class="mini-action ${getOutcome(item) === "lose" ? "is-lose" : ""}" type="button" data-close-event="${item.id}" data-outcome="lose">Lose</button>
      </div>
    </article>
  `;
}

function renderPeriodControls() {
  const periods = [
    ["today", "Сегодня"],
    ["7d", "7 дней"],
    ["all", "Всё время"]
  ];

  return `
    <div class="filter-chips stats-periods">
      ${periods.map(([id, label]) => `
        <button class="chip ${state.statsPeriod === id ? "is-active" : ""}" type="button" data-stats-period="${id}">${label}</button>
      `).join("")}
    </div>
  `;
}

function getPeriodMetricLabel() {
  if (state.statsPeriod === "today") return "Событий сегодня";
  if (state.statsPeriod === "7d") return "Событий за 7 дней";
  return "Событий за всё время";
}

function renderStats() {
  const totals = getDashboardStats();
  const dataQuality = getDataQualityStats();
  const periodHistory = getHistoryByPeriod(state.history, state.statsPeriod);
  const journalStats = getJournalStats(periodHistory);
  const patternRows = sortPatternRows(state.patterns.map((pattern) => getPatternStats(pattern, periodHistory)));
  const weakRows = getWeakPatternRows(patternRows);

  return `
    ${renderSummary(totals)}
    ${renderPeriodControls()}
    <section class="summary-grid journal-summary">
      ${metric(getPeriodMetricLabel(), journalStats.total)}
      ${metric("Win", journalStats.win)}
      ${metric("Lose", journalStats.lose)}
      ${metric("В процессе", journalStats.open)}
      ${metric("Общий win rate", `${journalStats.winRate}%`)}
    </section>
    <section class="section-grid">
      <div class="panel wide-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Аналитика</p>
            <h2>Pattern Analytics</h2>
          </div>
        </div>
        ${renderPatternSortControls()}
        <div class="analytics-table">
          <div class="analytics-head">
            <span>Паттерн</span><span>Сигналов</span><span>До 5</span><span>До 10</span><span>До 15</span><span>Не подтверждено</span><span>Pressure</span><span>Минута</span><span>Оценка</span><span>Статус</span>
          </div>
          ${patternRows.map((row) => `
            <div class="analytics-row ${row.status}">
              <span><strong>${row.pattern.name}</strong><small>${getPatternStatusReason(row)}</small></span>
              <span>${row.totalSignals}</span>
              <span>${row.successWithin5}</span>
              <span>${row.successWithin10}</span>
              <span>${row.successWithin15}</span>
              <span>${row.failedSignals}</span>
              <span>${row.averagePressureScore}</span>
              <span>${row.averageSignalMinute}'</span>
              <span><b>${row.qualityScore}/100</b><small>${getPatternQualityLabel(row)}</small></span>
              <span><b class="quality-badge ${row.status}">${patternStatusLabels[row.status]}</b></span>
            </div>
          `).join("")}
        </div>
      </div>
      <aside class="panel">
        <h2>Сводка по статусам</h2>
        ${renderPatternStatusSummary(patternRows)}
        ${renderWeakPatternWatchlist(weakRows)}
      </aside>
    </section>
    ${renderDataQualityPanel(dataQuality)}
  `;
}

function renderPatternAnalyticsDetails(stats) {
  return `
    <div class="pattern-analytics-details">
      <div>
        <h3>Эффективность</h3>
        <span>До 5 минут <b>${stats.successRate5}%</b></span>
        <span>До 10 минут <b>${stats.successRate10}%</b></span>
        <span>До 15 минут <b>${stats.successRate15}%</b></span>
        <span>Средний pressure score <b>${stats.averagePressureScore}</b></span>
      </div>
      <div>
        <h3>Лиги</h3>
        ${renderMiniGroup("Лучшие", stats.bestLeagues)}
        ${renderMiniGroup("Слабые", stats.weakLeagues)}
      </div>
      <div>
        <h3>Команды</h3>
        ${renderMiniGroup("Лучшие", stats.bestTeams)}
        ${renderMiniGroup("Слабые", stats.weakTeams)}
      </div>
      <div>
        <h3>Последние сигналы</h3>
        ${stats.history.slice(0, 50).map((event) => `<span>${event.match} · ${event.minute}' · ${formatOutcome(event)}</span>`).join("") || "<span>Пока нет событий</span>"}
      </div>
    </div>
  `;
}

function renderMiniGroup(label, rows) {
  return `
    <p class="mini-group-title">${label}</p>
    ${rows.length ? rows.map((row) => `<span>${row.name} <b>${row.rate15}%</b></span>`).join("") : "<span>Недостаточно данных</span>"}
  `;
}

function renderPatternStatusSummary(rows) {
  const statuses = Object.keys(patternStatusLabels);
  return `
    <div class="readiness-list">
      ${statuses.map((status) => `
        <span><b>${patternStatusLabels[status]}</b>${rows.filter((row) => row.status === status).length}</span>
      `).join("")}
    </div>
  `;
}

function renderPatternSortControls() {
  const controls = [
    ["quality", "По оценке"],
    ["weak", "Слабые"],
    ["sample", "Выборка"],
    ["pressure", "Индекс"]
  ];

  return `
    <div class="filter-chips compact analytics-sort">
      ${controls.map(([id, label]) => `
        <button class="chip ${state.patternSort === id ? "is-active" : ""}" type="button" data-pattern-sort="${id}">${label}</button>
      `).join("")}
    </div>
  `;
}

function renderWeakPatternWatchlist(rows) {
  return `
    <div class="watchlist">
      <h3>Требуют внимания</h3>
      ${rows.length ? rows.map((row) => `
        <span>
          <b>${row.pattern.name}</b>
          <small>${getPatternStatusReason(row)} Оценка ${row.qualityScore}/100.</small>
        </span>
      `).join("") : "<span><b>Нет явных слабых мест</b><small>Продолжаем собирать выборку.</small></span>"}
    </div>
  `;
}

function renderDataQualityPanel(stats) {
  return `
    <section class="panel data-quality-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Источник данных</p>
          <h2>Монитор качества данных</h2>
        </div>
        <span class="quality-badge ${stats.status}">${stats.label}</span>
      </div>
      <div class="data-quality-grid">
        ${dataQualityMetric("Матчи", stats.matches)}
        ${dataQualityMetric("Статистика", `${stats.statsCoverage}%`)}
        ${dataQualityMetric("События", `${stats.eventsCoverage}%`)}
        ${dataQualityMetric("Свежесть", stats.freshnessLabel)}
      </div>
      <div class="source-health-list">
        <span><b>${stats.providerMode}</b> режим источника</span>
        <span><b>${stats.snapshots}</b> снимков статистики</span>
        <span><b>${stats.eventMatches}</b> матчей с событиями</span>
        <span><b>${stats.lastUpdatedLabel}</b> последнее обновление</span>
      </div>
      <p class="muted">${stats.summary}</p>
    </section>
  `;
}

function dataQualityMetric(label, value) {
  return `<span class="data-quality-metric"><b>${value}</b>${label}</span>`;
}

function renderProfile() {
  const journalStats = getJournalStats(state.history);
  const profile = socialFeedback.getProfileViewModel(state.userProfile, journalStats);

  if (!profile) {
    return renderEmpty("Профиль пока не подготовлен.");
  }

  return `
    <section class="profile-layout">
      <div class="profile-hero panel">
        <div class="profile-avatar" aria-hidden="true">${escapeHtml(profile.avatar)}</div>
        <div>
          <p class="eyebrow">Закрытый MVP-профиль</p>
          <h2>${escapeHtml(profile.displayName)}</h2>
          <span>@${escapeHtml(profile.handle)} · ${escapeHtml(profile.role)}</span>
          <p>${escapeHtml(profile.bio)}</p>
        </div>
      </div>

      <section class="summary-grid">
        ${metric("Событий в журнале", profile.summary.totalEvents)}
        ${metric("Win", profile.summary.win)}
        ${metric("Lose", profile.summary.lose)}
        ${metric("Уровень доверия", profile.summary.trustScore)}
      </section>

      <section class="section-grid">
        <div class="panel">
          <div class="panel-heading">
            <div>
              <h2>Социальное доверие</h2>
              <p>${escapeHtml(profile.trust.level || "Профиль в подготовке")}</p>
            </div>
            <span class="count-pill">${profile.trust.score || 0}/100</span>
          </div>
          <div class="trust-meter"><span style="width: ${profile.trustMeterWidth}"></span></div>
          <div class="readiness-list">
            <span><b>${profile.trust.verifiedSignals || 0}</b> проверенных сигналов</span>
            <span><b>${profile.trust.reviewedIdeas || 0}</b> разобранных идей</span>
            <span><b>${profile.trust.sharedReports || 0}</b> публичных отчетов</span>
          </div>
          <div class="note-list">
            ${profile.trustNotes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")}
          </div>
        </div>

        <div class="panel">
          <h2>Права и будущие модули</h2>
          <div class="readiness-list">
            ${profile.permissions.map((item) => `
              <span><b>${profilePermissionLabel(item.status)}</b>${escapeHtml(item.label)}</span>
            `).join("")}
          </div>
          <div class="quality-note sample">
            <strong>Архитектурная заготовка</strong>
            <span>${profile.futureFields.map(escapeHtml).join(" · ")}</span>
          </div>
        </div>
      </section>
      ${renderTeamsWithNotes()}
    </section>
  `;
}

function renderIdeas() {
  const items = state.feedbackItems;
  const summary = socialFeedback.getIdeasSummary(items);

  return `
    <section>
      <section class="summary-grid">
        ${metric("Идей", summary.ideaCount)}
        ${metric("Отклики", summary.feedbackCount)}
        ${metric("Высокий приоритет", summary.highPriority)}
        ${metric("Всего голосов", summary.totalVotes)}
      </section>

      <div class="ideas-grid">
        ${items.map(renderIdeaCard).join("") || renderEmpty("Идей пока нет.")}
      </div>
    </section>
  `;
}

function renderIdeaCard(item) {
  return `
    <article class="idea-card panel">
      <div class="idea-card-top">
        <span class="quality-badge ${item.status}">${feedbackStatusLabel(item.status)}</span>
        <span class="count-pill">${feedbackTypeLabel(item.type)}</span>
      </div>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.description)}</p>
      <div class="idea-meta">
        <span>Приоритет: ${feedbackPriorityLabel(item.priority)}</span>
        <span>${item.votes} голосов</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
    </article>
  `;
}

function renderPatternBadges(signals) {
  return `
    <div class="pattern-badges">
      ${signals.map((signal) => `
        <span class="${signal.signalKind === "warning" ? "is-warning" : ""}">${patternTypeLabels[signal.patternType]}</span>
      `).join("")}
    </div>
  `;
}

function renderTeamNoteLog(note) {
  const entries = note.entries || [];
  return `
    <div class="team-note-log">
      <h4>Журнал заметок</h4>
      ${entries.length ? entries.slice(0, 4).map((entry) => `
        <span>
          <b>${formatDateTime(entry.createdAt)}</b>
          <small>${escapeHtml(entry.note || "Без текста")}</small>
          ${(entry.tags || []).length ? `<small>${entry.tags.map(escapeHtml).join(" · ")}</small>` : ""}
        </span>
      `).join("") : "<span><b>Пока пусто</b><small>Сохраните текущую заметку, чтобы добавить запись.</small></span>"}
    </div>
  `;
}

function renderTeamsWithNotes() {
  const rows = getTeamsWithNotes();
  return `
    <section class="panel notes-overview">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Личные наблюдения</p>
          <h2>Команды с заметками</h2>
        </div>
        <span class="count-pill">${rows.length}</span>
      </div>
      <div class="notes-overview-list">
        ${rows.length ? rows.map((row) => `
          <span>
            <b>${escapeHtml(row.name)}</b>
            <small>${row.noteCount} записей · ${escapeHtml((row.tags || []).join(", ") || "без тегов")}${row.importantMatch ? " · важный матч" : ""}</small>
          </span>
        `).join("") : "<span><b>Заметок пока нет</b><small>Откройте профиль команды и сохраните наблюдение.</small></span>"}
      </div>
    </section>
  `;
}

function renderThresholdControl(pattern, rule, index) {
  const numericValue = typeof rule.value === "number";
  const value = numericValue ? rule.value : String(rule.value);
  return `
    <label class="threshold-row">
      <span>
        <b>${rule.label || rule.field}</b>
        <small>${formatRuleContext(rule)}</small>
      </span>
      <input
        type="${numericValue ? "number" : "text"}"
        value="${escapeHtml(value)}"
        data-rule-setting
        data-rule-pattern="${pattern.id}"
        data-rule-index="${index}"
        ${numericValue ? "step=\"1\"" : ""}
      >
    </label>
  `;
}

function renderPatternProfiles(pattern) {
  const profiles = state.patternProfiles.filter((profile) => profile.patternId === pattern.id);
  return `
    <div class="saved-profile-list">
      <h3>Сохраненные профили</h3>
      ${profiles.length ? profiles.map((profile) => `
        <span>
          <b>${escapeHtml(profile.name)}</b>
          <small>${formatDateTime(profile.createdAt)} · ${profile.rules.length} условий</small>
          <button class="mini-action" type="button" data-apply-pattern-profile="${profile.id}">Применить</button>
        </span>
      `).join("") : "<span><b>Пока нет профилей</b><small>Сохраните текущие условия, чтобы быстро возвращаться к ним.</small></span>"}
    </div>
  `;
}

function renderSettings() {
  const telegramStatus = settingsService.getTelegramStatus(state.settings, formatDateTime, escapeHtml);
  const dataQuality = getDataQualityStats();

  return `
    <section class="settings-grid">
      <div class="panel">
        <h2>Режим данных</h2>
        <label class="switch field-row">
          <input id="mockMode" type="checkbox" ${state.settings.mockMode ? "checked" : ""}>
          <span>Демо-данные</span>
        </label>
        <p class="muted">Слой данных подготовлен под MockFootballProvider и будущий RealFootballProvider.</p>
      </div>

      <div class="panel">
        <h2>Избранные лиги</h2>
        <div class="setting-stack">
          <span class="rule-chip">Portugal Liga 2</span>
          <span class="rule-chip">Sweden Superettan</span>
          <span class="rule-chip">Japan J2 League</span>
        </div>
      </div>

      <div class="panel telegram-card">
        <h2>Уведомления в Telegram</h2>
        <label class="switch field-row">
          <input id="telegramEnabled" type="checkbox" ${state.settings.telegramEnabled ? "checked" : ""}>
          <span>Telegram-уведомления</span>
        </label>
        <label class="input-label">
          Канал или chat id
          <input id="telegramChannel" type="text" value="${escapeHtml(state.settings.telegramChannel)}" placeholder="@my_channel">
        </label>
        <button class="primary-button" id="testTelegram" type="button">Отправить тестовое сообщение</button>
        ${telegramStatus}
      </div>

      <div class="panel">
        <h2>API-адаптер</h2>
        <pre class="code-block">FootballDataProvider
  getLiveMatches()
  getMatchStats(matchId)
  getMatchEvents(matchId)
  getPatterns()
  getTeamProfile(teamId)
  getTeamRecentMatches(teamId)
  getUserProfile()
  getFeedbackItems()</pre>
        <p class="muted">Интерфейс оставлен независимым от поставщика данных: сейчас работает MockFootballProvider, дальше подключается RealFootballProvider.</p>
        <div class="quality-note ${dataQuality.status}">
          <strong>${dataQuality.label}</strong>
          <span>${dataQuality.summary}</span>
        </div>
      </div>

      <div class="panel">
        <h2>Профиль пользователя</h2>
        <div class="readiness-list">
          <span><b>Готово</b> локальная история сигналов</span>
          <span><b>Готово</b> экспорт журнала</span>
          <span><b>Дальше</b> вход и личный профиль</span>
          <span><b>Дальше</b> сохранение настроек в облаке</span>
        </div>
      </div>
    </section>
  `;
}

function renderSummary(stats) {
  return `
    <section class="summary-grid">
      ${metric("Матчи онлайн", stats.liveMatches)}
      ${metric("Активные сигналы", stats.activeSignals)}
      ${metric("Высокие сигналы", stats.highSignals)}
      ${metric("Средний индекс давления", stats.averagePressure)}
    </section>
  `;
}

function renderFilterChips() {
  const chips = [
    ["all", "Все"],
    ["scoreless", "0:0"],
    ["late", "60+"],
    ["top", "Топ лиги"],
    ["mine", "Мои"],
    ["HIGH", "HIGH"],
    ["MED", "MED"],
    ["LOW", "LOW"]
  ];

  return `
    <div class="filter-chips">
      ${chips.map(([id, label]) => `
        <button class="chip ${state.activeFilter === id ? "is-active" : ""}" type="button" data-filter="${id}">${label}</button>
      `).join("")}
    </div>
  `;
}

function renderMatchCard(match) {
  const snapshot = getSnapshot(match.id);
  const signals = state.signals.filter((signal) => signal.matchId === match.id);
  const mainSignal = signals[0];
  const homePressure = patternEngine.calculatePressureScore(snapshot.home);
  const awayPressure = patternEngine.calculatePressureScore(snapshot.away);
  const pressure = Math.max(homePressure, awayPressure);

  return `
    <article class="match-card">
      <div class="card-topline">
        <span class="live-pill">${match.status === "halftime" ? "Перерыв" : "Онлайн"}</span>
        <span>${match.minute}'</span>
        <span>${match.league}</span>
      </div>
      <div class="scoreboard">
        <button class="team-link" type="button" data-team-profile="${escapeHtml(match.homeTeam)}" data-team-id="${match.homeTeamId || ""}" data-match-id="${match.id}" data-team-side="home">${match.homeTeam}</button>
        <b>${match.scoreHome}:${match.scoreAway}</b>
        <button class="team-link" type="button" data-team-profile="${escapeHtml(match.awayTeam)}" data-team-id="${match.awayTeamId || ""}" data-match-id="${match.id}" data-team-side="away">${match.awayTeam}</button>
      </div>
      <div class="pattern-callout">
        <div>
          <small class="signal-caption">${mainSignal ? "Обнаружен паттерн" : "Наблюдение"}</small>
          <p>${mainSignal ? patternTypeLabels[mainSignal.patternType] : "Паттерн не обнаружен"}</p>
          <span>${mainSignal ? mainSignal.explanation : "Идет наблюдение"}</span>
          ${signals.length > 1 ? renderPatternBadges(signals) : ""}
        </div>
        <div class="signal-score">
          <span class="strength ${mainSignal ? mainSignal.strength.toLowerCase() : patternEngine.getSignalStrength(pressure).toLowerCase()}">${mainSignal ? mainSignal.strength : patternEngine.getSignalStrength(pressure)}</span>
          <span class="pressure-badge ${patternEngine.getSignalStrength(pressure).toLowerCase()}">${pressure}</span>
        </div>
      </div>
      <div class="stat-grid compact">
        ${statMetric("Опасные", snapshot.home.dangerousAttacks, snapshot.away.dangerousAttacks)}
        ${statMetric("Удары", snapshot.home.shotsTotal, snapshot.away.shotsTotal)}
        ${statMetric("В створ", snapshot.home.shotsOnTarget, snapshot.away.shotsOnTarget)}
        ${statMetric("Угловые", snapshot.home.corners, snapshot.away.corners)}
        ${statMetric("xG", snapshot.home.xg.toFixed(2), snapshot.away.xg.toFixed(2))}
      </div>
      <div class="trend-row">
        <span class="trend-indicator ${getTrendDirection(snapshot.recent.home, snapshot.previous.home)}">Тренд: ${formatTrend(snapshot.recent.home, snapshot.previous.home)}</span>
        <span class="strength ${mainSignal ? mainSignal.strength.toLowerCase() : "low"}">${mainSignal ? strengthLabels[mainSignal.strength] : strengthLabels.LOW}</span>
      </div>
    </article>
  `;
}

function renderTeamProfile(selection) {
  const profile = getTeamProfile(selection);
  if (!profile) {
    return "";
  }
  const averages = profile.averages || {};
  const note = getTeamNote(profile.id);

  return `
    <section class="team-profile-panel">
      <div class="team-profile-header">
        <div class="team-logo" aria-hidden="true">${profile.logo || profile.name.slice(0, 3).toUpperCase()}</div>
        <div>
          <p class="eyebrow">Профиль команды</p>
          <h2>${profile.name}</h2>
          <span>${profile.country || "Страна не указана"} · ${profile.league || profile.match.league}</span>
          <small>Последние ${averages.matchesCount || profile.recentMatches?.length || 0} матчей: ${averages.wins || 0} побед · ${averages.draws || 0} ничьих · ${averages.losses || 0} поражений</small>
        </div>
        <button class="mini-action" type="button" data-close-team-profile>Закрыть</button>
      </div>
      <div class="team-profile-grid">
        ${metric("Pressure score", profile.pressureScore)}
        ${metric("Опасные атаки", profile.stats.dangerousAttacks)}
        ${metric("Удары", profile.stats.shotsTotal)}
        ${metric("xG", profile.stats.xg.toFixed(2))}
      </div>
      <div class="team-profile-body">
        <article>
          <h3>Текущий контекст</h3>
          <p>${profile.summary}</p>
        </article>
        <article class="team-note-card">
          <h3>Моя заметка</h3>
          <textarea class="team-note-field" data-team-note="${profile.id}" placeholder="Наблюдения по команде">${escapeHtml(note.note || "")}</textarea>
          <label class="team-tags-field">
            Теги через запятую
            <input type="text" data-team-tags="${profile.id}" value="${escapeHtml((note.tags || []).join(", "))}" placeholder="темп, фланги, прессинг">
          </label>
          <div class="team-tags">
            ${(note.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "<span>Тегов пока нет</span>"}
          </div>
          <label class="switch field-row">
            <input type="checkbox" data-team-important="${profile.id}" ${note.importantMatch ? "checked" : ""}>
            <span>Важный матч</span>
          </label>
          <button class="ghost-button" type="button" data-save-team-note="${profile.id}">Сохранить в журнал заметок</button>
          ${renderTeamNoteLog(note)}
        </article>
        <article>
          <h3>Сигналы команды</h3>
          ${profile.signals.length ? profile.signals.map((signal) => `
            <span class="profile-signal">${patternTypeLabels[signal.patternType]} · ${signal.minute}' · ${strengthLabels[signal.strength]}</span>
          `).join("") : "<p class=\"muted\">Активных сигналов по команде нет.</p>"}
        </article>
        <article>
          <h3>История</h3>
          <p>${profile.history.total} событий · Win ${profile.history.win} · Lose ${profile.history.lose} · в процессе ${profile.history.open}</p>
        </article>
      </div>
      <div class="team-profile-sections">
        ${renderTeamAverages(profile)}
        ${renderTeamPeriodAverages(profile)}
        ${renderTeamPatterns(profile)}
        ${renderTeamRecentMatches(profile)}
        ${renderImportantMatches(profile)}
      </div>
    </section>
  `;
}

function renderCompactSignal(signal) {
  const match = state.matches.find((item) => item.id === signal.matchId);
  return `
    <article class="compact-signal">
      <div>
        <strong>${patternTypeLabels[signal.patternType]}</strong>
        <span>${match.homeTeam} - ${match.awayTeam}, ${signal.minute}'</span>
        <small>${signal.explanation}</small>
      </div>
      <span class="strength ${signal.strength.toLowerCase()}">${strengthLabels[signal.strength]}</span>
    </article>
  `;
}

function renderTeamAverages(profile) {
  const averages = profile.averages;
  if (!averages) return "";

  return `
    <article class="team-section">
      <h3>Средние значения</h3>
      <div class="mini-stats">
        ${metric("Голы", averages.goalsFor)}
        ${metric("Пропущенные", averages.goalsAgainst)}
        ${metric("Удары", averages.shotsTotal)}
        ${metric("В створ", averages.shotsOnTarget)}
        ${metric("Угловые", averages.corners)}
        ${metric("Атаки", averages.attacks)}
        ${metric("Опасные атаки", averages.dangerousAttacks)}
        ${metric("Pressure score", averages.pressureScore)}
      </div>
    </article>
  `;
}

function renderTeamPeriodAverages(profile) {
  if (!profile.firstHalfAverages && !profile.secondHalfAverages) return "";
  const rows = [
    ["1 тайм", profile.firstHalfAverages],
    ["2 тайм", profile.secondHalfAverages]
  ].filter(([, stats]) => stats);

  return `
    <article class="team-section">
      <h3>Средние по таймам</h3>
      <div class="team-mini-table period-table">
        <div><b>Период</b><b>Опасные</b><b>Удары</b><b>В створ</b><b>Угловые</b><b>Pressure</b></div>
        ${rows.map(([label, stats]) => `
          <div><span>${label}</span><span>${stats.dangerousAttacks}</span><span>${stats.shotsTotal}</span><span>${stats.shotsOnTarget}</span><span>${stats.corners}</span><span>${stats.pressureScore}</span></div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderTeamPatterns(profile) {
  const patterns = profile.characteristicPatterns || [];
  return `
    <article class="team-section">
      <h3>Характерные паттерны команды</h3>
      <div class="team-mini-table pattern-table">
        <div><b>Паттерн</b><b>Сигналов</b><b>До 10</b><b>До 15</b><b>Минута</b><b>Pressure</b><b>Label</b></div>
        ${patterns.map((pattern) => `
          <div>
            <span>${pattern.patternName}</span>
            <span>${pattern.totalSignals}</span>
            <span>${pattern.successRate10}%</span>
            <span>${pattern.successRate15}%</span>
            <span>${pattern.averageMinute}'</span>
            <span>${pattern.averagePressureScore}</span>
            <span><b class="team-pattern-label ${pattern.label}">${formatTeamPatternLabel(pattern.label)}</b></span>
          </div>
        `).join("") || "<div><span>Недостаточно данных</span></div>"}
      </div>
    </article>
  `;
}

function renderTeamRecentMatches(profile) {
  const matches = profile.recentMatches || [];
  return `
    <article class="team-section wide">
      <h3>Последние матчи</h3>
      <div class="team-mini-table recent-table">
        <div><b>Дата</b><b>Соперник</b><b>Счет</b><b>Турнир</b><b>Статус</b><b>Важность</b></div>
        ${matches.map((match) => `
          <div><span>${formatDate(match.date)}</span><span>${match.opponent}</span><span>${match.score}</span><span>${match.tournament}</span><span>${formatMatchResult(match.status)}</span><span>${formatImportance(match.importanceReason)}</span></div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderImportantMatches(profile) {
  const matches = profile.importantMatches || [];
  return `
    <article class="team-section wide">
      <h3>Важные матчи</h3>
      <div class="important-list">
        ${matches.map((match) => `
          <div>
            <strong>${formatDate(match.date)} · ${match.opponent} · ${match.score}</strong>
            <span>${match.tournament} · ${formatImportance(match.importanceReason)} · ${match.importanceLevel}</span>
            <small>${match.triggeredPatterns.join(", ")}</small>
          </div>
        `).join("") || "<p class=\"muted\">Важных матчей пока нет.</p>"}
      </div>
    </article>
  `;
}

function renderSignalRow(signal) {
  const match = state.matches.find((item) => item.id === signal.matchId);
  return `
    <article class="signal-row-card">
      <div>
        <strong>${patternTypeLabels[signal.patternType]}</strong>
        <span>${match.homeTeam} - ${match.awayTeam} · ${match.league}</span>
        <small>${signal.explanation}</small>
      </div>
      <span>${signal.minute}'</span>
      <span>${signal.scoreHome}:${signal.scoreAway}</span>
      <span class="pressure-badge ${signal.strength.toLowerCase()}">${signal.pressureScore}</span>
      <span class="status-dot-wrap"><b class="status-dot ${signal.status}"></b>${statusLabels[signal.status]}</span>
    </article>
  `;
}

function metric(label, value) {
  return `
    <article class="metric-card">
      <strong>${value}</strong>
      <span>${label}</span>
    </article>
  `;
}

function statMetric(label, home, away) {
  const trend = Number(home) >= Number(away) ? "up" : "down";
  return `
    <div class="stat-metric">
      <span>${label}</span>
      <strong>${home}-${away}</strong>
      <i class="${trend}" aria-hidden="true"></i>
    </div>
  `;
}

function getTrendDirection(recent, previous) {
  if (!recent || !previous) return "flat";
  if (recent.dangerousAttacks > previous.dangerousAttacks * 1.25) return "up";
  if (recent.dangerousAttacks < previous.dangerousAttacks * 0.85) return "down";
  return "flat";
}

function formatTrend(recent, previous) {
  const direction = getTrendDirection(recent, previous);
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const label = direction === "up" ? "темп растет" : direction === "down" ? "темп снижается" : "темп ровный";
  return `${arrow} ${label}`;
}

function renderEmpty(text) {
  return `<div class="empty-state">${text}</div>`;
}

function getFilteredMatches() {
  return state.matches.filter((match) => {
    if (state.activeFilter === "scoreless") return match.scoreHome + match.scoreAway === 0;
    if (state.activeFilter === "late") return match.minute >= 60;
    if (state.activeFilter === "top") return match.isTopLeague;
    if (state.activeFilter === "mine") return state.settings.favoriteLeagues.includes(match.league);
    if (["HIGH", "MED", "LOW"].includes(state.activeFilter)) {
      return state.signals.some((signal) => signal.matchId === match.id && signal.strength === state.activeFilter);
    }
    return true;
  });
}

function getDashboardStats() {
  const pressures = state.snapshots.flatMap((snapshot) => [
    patternEngine.calculatePressureScore(snapshot.home),
    patternEngine.calculatePressureScore(snapshot.away)
  ]);
  const averagePressure = pressures.length ? Math.round(pressures.reduce((sum, item) => sum + item, 0) / pressures.length) : 0;

  return {
    liveMatches: state.matches.filter((match) => match.status === "live").length,
    activeSignals: state.signals.length,
    highSignals: state.signals.filter((signal) => signal.strength === "HIGH").length,
    averagePressure
  };
}

function getDataQualityStats() {
  const matches = state.matches.length;
  const snapshots = state.snapshots.length;
  const eventMatches = Object.values(state.matchEvents || {}).filter((events) => events.length > 0).length;
  const statsCoverage = getRate(snapshots, matches || 1);
  const eventsCoverage = getRate(eventMatches, matches || 1);
  const updatedTimes = state.matches
    .map((match) => new Date(match.updatedAt || state.serviceMeta.startedAt).getTime())
    .filter(Number.isFinite);
  const lastUpdated = updatedTimes.length ? new Date(Math.max(...updatedTimes)) : new Date(state.serviceMeta.startedAt);
  const ageMinutes = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 60000));
  const freshnessScore = ageMinutes <= 3 ? 100 : ageMinutes <= 10 ? 70 : 35;
  const healthScore = Math.round((statsCoverage * 0.45) + (eventsCoverage * 0.25) + (freshnessScore * 0.3));
  const status = healthScore >= 85 ? "working" : healthScore >= 65 ? "testing" : "weak";
  const labels = {
    working: "Источник готов",
    testing: "Нужно наблюдение",
    weak: "Есть пробелы"
  };

  return {
    matches,
    snapshots,
    eventMatches,
    statsCoverage,
    eventsCoverage,
    providerMode: footballProvider.mode === "mock" ? "MockFootballProvider" : "RealFootballProvider",
    freshnessLabel: ageMinutes <= 1 ? "сейчас" : `${ageMinutes} мин`,
    lastUpdatedLabel: formatDateTime(lastUpdated.toISOString()),
    healthScore,
    status,
    label: labels[status],
    summary: `Покрытие статистики ${statsCoverage}%, покрытие событий ${eventsCoverage}%, оценка качества ${healthScore}/100.`
  };
}

function getTeamProfile(selection) {
  return teamProfileService.buildTeamProfile({
    selection,
    matches: state.matches,
    snapshots: state.snapshots,
    signals: state.signals,
    history: state.history,
    provider: footballProvider,
    patternEngine,
    getJournalStats
  });
}

function getTeamNote(teamId) {
  return teamProfileService.getTeamNote(state.teamNotes, teamId);
}

function updateTeamNote(teamId, patch) {
  state.teamNotes = teamProfileService.updateTeamNote(state.teamNotes, teamId, patch);
  writeTeamNotes();
}

function saveTeamNoteSnapshot(teamId) {
  state.teamNotes = teamProfileService.saveTeamNoteSnapshot(state.teamNotes, teamId);
  writeTeamNotes();
}

function getTeamsWithNotes() {
  return teamProfileService.getTeamsWithNotes(state.teamNotes, state.matches, footballProvider);
}

function getTeamNameById(teamId) {
  return teamProfileService.getTeamNameById(teamId, state.matches, footballProvider);
}

function getPatternStats(pattern, events) {
  return patternAnalytics.getPatternStats(pattern, events, state.matches);
}

function sortPatternRows(rows) {
  return patternAnalytics.sortPatternRows(rows, state.patternSort);
}

function getWeakPatternRows(rows) {
  return patternAnalytics.getWeakPatternRows(rows);
}

function getPatternQualityScore(stats) {
  return patternAnalytics.getPatternQualityScore(stats);
}

function getPatternQualityLabel(row) {
  return patternAnalytics.getPatternQualityLabel(row);
}

function getPatternAnalyticsStatus({ pattern, totalSignals, successRate15 }) {
  return patternAnalytics.getPatternAnalyticsStatus({ pattern, totalSignals, successRate15 });
}

function getPatternStatusReason(stats) {
  return patternAnalytics.getPatternStatusReason(stats);
}

function getRate(value, total) {
  return patternAnalytics.getRate(value, total);
}

function getAverage(values) {
  return patternAnalytics.getAverage(values);
}

function getEventTeamName(event) {
  return patternAnalytics.getEventTeamName(event, state.matches);
}

function getFilteredHistory() {
  return historyService.getFilteredHistory(state.history, state.historyFilter);
}

function getHistoryByPeriod(events, period) {
  return historyService.getHistoryByPeriod(events, period);
}

function updatePatternEvent(id, patch) {
  state.history = state.history.map((event) => {
    if (event.id !== id) return event;
    return normalizePatternEvent({
      ...event,
      ...patch,
      result: { ...event.result, ...patch.result },
      updatedAt: new Date().toISOString()
    });
  });
  writePatternEvents();
}

function closePatternEvent(id, outcome) {
  const isWin = outcome === "win";
  updatePatternEvent(id, {
    status: isWin ? "success" : "failed",
    resultSource: "manual",
    result: {
      goalWithin5: false,
      goalWithin10: isWin,
      goalWithin15: isWin,
      goalMinute: null,
      goalTeam: null,
      finalComment: "",
      manualOutcome: outcome
    },
    updatedAt: new Date().toISOString(),
    closedAt: new Date().toISOString()
  });
}

function exportHistory(format) {
  const events = getFilteredHistory();
  const { filename, content, type } = historyService.buildHistoryExport({
    events,
    filter: state.historyFilter,
    format,
    patternLabels: patternTypeLabels
  });
  downloadFile(filename, content, type);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readServiceMeta() {
  return storage.readServiceMeta();
}

function readPatternEvents(seedEvents) {
  const stored = storage.readPatternEvents();
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map(normalizePatternEvent).sort(sortEventsByTime);
  }

  const seeded = seedEvents.map(normalizePatternEvent).sort(sortEventsByTime);
  storage.writePatternEvents(seeded);
  return seeded;
}

function writePatternEvents() {
  storage.writePatternEvents(state.history);
}

function syncActiveSignalsToJournal() {
  let changed = false;
  state.signals.forEach((signal) => {
    if (hasRecentJournalSignal(signal)) {
      return;
    }
    state.history.unshift(signalToJournalEvent(signal));
    changed = true;
  });

  if (changed) {
    state.history = state.history.map(normalizePatternEvent).sort(sortEventsByTime);
    writePatternEvents();
  }
}

function syncSignalResults() {
  let changed = false;
  state.history = state.history.map((event) => {
    if (!event.matchId || event.result?.manualOutcome) {
      return event;
    }

    const match = state.matches.find((item) => item.id === event.matchId);
    const events = getMatchEvents(event.matchId);
    const evaluated = signalResultEngine.evaluateSignalResult(event, match, events);
    const nextResult = { ...event.result, ...evaluated.result };
    const nextEvent = normalizePatternEvent({
      ...event,
      status: evaluated.status,
      resultSource: ["success", "failed"].includes(evaluated.status) ? "auto" : event.resultSource,
      result: nextResult,
      updatedAt: new Date().toISOString(),
      closedAt: ["success", "failed"].includes(evaluated.status) ? event.closedAt || new Date().toISOString() : event.closedAt
    });

    if (nextEvent.status !== event.status || JSON.stringify(nextEvent.result) !== JSON.stringify(event.result)) {
      changed = true;
      return nextEvent;
    }

    return event;
  }).sort(sortEventsByTime);

  if (changed) {
    writePatternEvents();
  }
}

function hasRecentJournalSignal(signal) {
  return state.history.some((event) =>
    event.matchId === signal.matchId &&
    event.patternId === signal.patternId &&
    event.teamSide === signal.teamSide &&
    Math.abs(Number(event.minute || 0) - Number(signal.minute || 0)) < 10
  );
}

function getMatchEvents(matchId) {
  return state.matchEvents?.[matchId] || footballProvider.getMatchEvents?.(matchId) || [];
}

function signalToJournalEvent(signal) {
  const match = state.matches.find((item) => item.id === signal.matchId);
  const evaluated = signalResultEngine.evaluateSignalResult(signal, match, getMatchEvents(signal.matchId));
  return {
    id: signal.id,
    match: `${match.homeTeam} - ${match.awayTeam}`,
    matchId: signal.matchId,
    league: match.league,
    minute: signal.minute,
    patternId: signal.patternId,
    patternType: signal.patternType,
    teamId: signal.teamId || (signal.teamSide === "home" ? match.homeTeamId : match.awayTeamId),
    teamSide: signal.teamSide,
    scoreHome: signal.scoreHome,
    scoreAway: signal.scoreAway,
    score: `${signal.scoreHome}:${signal.scoreAway}`,
    status: evaluated.status,
    result: {
      goalWithin5: false,
      goalWithin10: false,
      goalWithin15: false,
      goalMinute: null,
      goalTeam: null,
      finalComment: "",
      ...evaluated.result
    },
    comment: "",
    pressureScore: signal.pressureScore,
    strength: signal.strength,
    signalKind: signal.signalKind || "signal",
    resultSource: ["success", "failed"].includes(evaluated.status) ? "auto" : "auto",
    statsAtSignal: signal.statsAtSignal || getSignalStats(signal),
    explanation: signal.explanation,
    createdAt: signal.createdAt,
    updatedAt: signal.updatedAt || signal.createdAt,
    closedAt: null
  };
}

function normalizePatternEvent(event) {
  const scoreParts = String(event.score || "0:0").split(":");
  const scoreHome = Number.isFinite(event.scoreHome) ? event.scoreHome : Number(scoreParts[0] || 0);
  const scoreAway = Number.isFinite(event.scoreAway) ? event.scoreAway : Number(scoreParts[1] || 0);
  const normalized = {
    id: event.id || `${event.match}-${event.patternId}-${event.minute}-${event.score}`.replaceAll(" ", "-"),
    match: event.match,
    matchId: event.matchId || "",
    league: event.league,
    minute: event.minute,
    patternId: event.patternId,
    patternType: event.patternType,
    teamId: event.teamId || "",
    teamSide: event.teamSide || "both",
    scoreHome,
    scoreAway,
    score: event.score || `${scoreHome}:${scoreAway}`,
    status: event.status,
    result: normalizeSignalResult(event.result, event.comment),
    comment: event.comment || "",
    pressureScore: event.pressureScore || null,
    strength: event.strength || null,
    signalKind: event.signalKind || (event.patternType === "empty_pressure" ? "warning" : "signal"),
    resultSource: event.resultSource || (event.result?.manualOutcome ? "manual" : event.matchId ? "auto" : "seed"),
    statsAtSignal: event.statsAtSignal || null,
    explanation: event.explanation || "Событие добавлено в журнал до появления подробных объяснений.",
    createdAt: event.createdAt || event.occurredAt || state.serviceMeta.startedAt,
    updatedAt: event.updatedAt || event.createdAt || event.occurredAt || state.serviceMeta.startedAt,
    closedAt: event.closedAt || null
  };

  return normalized;
}

function normalizeSignalResult(result = {}, fallbackComment = "") {
  return {
    goalWithin5: Boolean(result.goalWithin5),
    goalWithin10: Boolean(result.goalWithin10),
    goalWithin15: Boolean(result.goalWithin15),
    goalMinute: Number.isFinite(result.goalMinute) ? result.goalMinute : null,
    goalTeam: result.goalTeam || null,
    finalComment: result.finalComment || fallbackComment || "",
    manualOutcome: result.manualOutcome || null
  };
}

function getSignalStats(signal) {
  const snapshot = getSnapshot(signal.matchId);
  if (!snapshot || !signal.teamSide || signal.teamSide === "both") {
    return null;
  }
  return snapshot[signal.teamSide] || null;
}

function getJournalStats(events = state.history) {
  return historyService.getJournalStats(events, state.serviceMeta.startedAt);
}

function sortEventsByTime(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function refreshMockData() {
  state.matches = state.matches.map((match) => ({
    ...match,
    minute: Math.min(90, match.minute + 1),
    updatedAt: new Date().toISOString()
  }));
  state.snapshots = state.snapshots.map((snapshot) => ({
    ...snapshot,
    minute: Math.min(90, snapshot.minute + 1),
    home: bumpStats(snapshot.home),
    away: bumpStats(snapshot.away)
  }));
  state.signals = evaluateCurrentMatches();
  syncActiveSignalsToJournal();
  syncSignalResults();
  render();
}

function bumpStats(stats) {
  return {
    ...stats,
    attacks: stats.attacks + 1,
    dangerousAttacks: stats.dangerousAttacks + (stats.dangerousAttacks > 40 ? 1 : 0),
    shotsTotal: stats.shotsTotal + (stats.shotsTotal % 2 === 0 ? 1 : 0),
    xg: Number((stats.xg + 0.03).toFixed(2))
  };
}

function evaluateCurrentMatches() {
  return patternEngine.evaluateAllMatches(state.matches, state.snapshots, getEffectivePatterns());
}

function getSnapshot(matchId) {
  return state.snapshots.find((snapshot) => snapshot.matchId === matchId);
}

function formatRule(rule) {
  const period = rule.period && rule.period !== "total" ? ` ${rule.period.replace("_", " ")}` : "";
  return `${rule.label || rule.field}${period} ${rule.operator} ${rule.value}`;
}

function formatRuleContext(rule) {
  const period = rule.period && rule.period !== "total" ? ` · ${rule.period.replace("_", " ")}` : "";
  return `${rule.field} ${rule.operator}${period}`;
}

function getPatternRules(pattern) {
  const stored = state.patternSettings[pattern.id];
  if (!stored?.rules) {
    return pattern.rules;
  }

  return pattern.rules.map((rule, index) => ({
    ...rule,
    value: stored.rules[index]?.value ?? rule.value
  }));
}

function updatePatternRuleSetting(patternId, ruleIndex, value) {
  const pattern = state.patterns.find((item) => item.id === patternId);
  if (!pattern) return;

  const rules = getPatternRules(pattern).map((rule) => ({ value: rule.value }));
  const baseRule = pattern.rules[ruleIndex];
  rules[ruleIndex] = {
    value: typeof baseRule.value === "number" ? Number(value) : value
  };
  state.patternSettings[patternId] = {
    updatedAt: new Date().toISOString(),
    rules
  };
  writePatternSettings();
  state.signals = evaluateCurrentMatches();
  syncActiveSignalsToJournal();
  syncSignalResults();
}

function getEffectivePatterns() {
  return state.patterns.map((pattern) => ({
    ...pattern,
    rules: getPatternRules(pattern)
  }));
}

function savePatternProfile(patternId) {
  const pattern = state.patterns.find((item) => item.id === patternId);
  if (!pattern) return;

  const name = state.patternProfileDraftName.trim() || `${pattern.name} · ${formatDate(new Date().toISOString())}`;
  const profile = {
    id: `${patternId}-${Date.now()}`,
    patternId,
    name,
    rules: getPatternRules(pattern).map((rule) => ({ value: rule.value })),
    createdAt: new Date().toISOString()
  };
  state.patternProfiles = [profile, ...state.patternProfiles].slice(0, 30);
  state.patternProfileDraftName = "";
  writePatternProfiles();
}

function applyPatternProfile(profileId) {
  const profile = state.patternProfiles.find((item) => item.id === profileId);
  if (!profile) return;

  state.patternSettings[profile.patternId] = {
    updatedAt: new Date().toISOString(),
    rules: profile.rules
  };
  writePatternSettings();
  state.activePatternId = profile.patternId;
  state.signals = evaluateCurrentMatches();
  syncActiveSignalsToJournal();
  syncSignalResults();
}

function exportPatternProfiles() {
  const payload = {
    exportedAt: new Date().toISOString(),
    profiles: state.patternProfiles
  };
  downloadFile("football-pattern-profiles.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
}

function importPatternProfiles(input) {
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
      state.patternProfiles = [...profiles, ...state.patternProfiles]
        .filter((profile) => profile.id && profile.patternId && Array.isArray(profile.rules))
        .slice(0, 30);
      writePatternProfiles();
      render();
    } catch {
      input.value = "";
    }
  });
  reader.readAsText(file);
}

function readSettings() {
  return storage.readSettings();
}

function writeSettings() {
  storage.writeSettings(state.settings);
}

function readPatternSettings() {
  return storage.readPatternSettings();
}

function writePatternSettings() {
  storage.writePatternSettings(state.patternSettings);
}

function readPatternProfiles() {
  return storage.readPatternProfiles();
}

function writePatternProfiles() {
  storage.writePatternProfiles(state.patternProfiles);
}

function readTeamNotes() {
  return storage.readTeamNotes();
}

function writeTeamNotes() {
  storage.writeTeamNotes(state.teamNotes);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
