const SERVICE_META_KEY = "football-pattern-lab-service-meta";
const PATTERN_EVENTS_KEY = "football-pattern-lab-pattern-events";
const footballProvider = window.FootballDataProvider.createFootballProvider("mock");
const patternEngine = window.FootballPatternEngine;
const telegramService = window.FootballTelegramService.createTelegramService();

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
  activePatternId: "pressure_without_goal",
  settings: readSettings(),
  patterns: [],
  matches: [],
  snapshots: [],
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
  late_goal: "Поздняя активность",
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
  state.history = readPatternEvents(footballProvider.getSeedHistory());
  state.userProfile = footballProvider.getUserProfile?.();
  state.feedbackItems = footballProvider.getFeedbackItems?.() || [];
  state.signals = evaluateCurrentMatches();
  syncActiveSignalsToJournal();

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

  const telegramToggle = root.querySelector("#telegramEnabled");
  if (telegramToggle) {
    telegramToggle.addEventListener("change", () => {
      state.settings.telegramEnabled = telegramToggle.checked;
      writeSettings();
      render();
    });
  }

  const telegramChannel = root.querySelector("#telegramChannel");
  if (telegramChannel) {
    telegramChannel.addEventListener("input", () => {
      state.settings.telegramChannel = telegramChannel.value;
      writeSettings();
    });
  }

  const mockMode = root.querySelector("#mockMode");
  if (mockMode) {
    mockMode.addEventListener("change", () => {
      state.settings.mockMode = mockMode.checked;
      writeSettings();
    });
  }

  const testTelegram = root.querySelector("#testTelegram");
  if (testTelegram) {
    testTelegram.addEventListener("click", async () => {
      testTelegram.disabled = true;
      testTelegram.textContent = "Готовим сообщение";
      state.settings.lastTelegramTest = await telegramService.sendTelegramTestMessage(state.settings);
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
        <div class="rule-grid">
          ${activePattern.rules.map((rule) => `<span class="rule-chip">${formatRule(rule)}</span>`).join("")}
          <button class="ghost-button" type="button">+ Добавить условие</button>
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
          <span>Матч</span><span>Паттерн</span><span>Минута</span><span>Счет</span><span>Статус</span><span>Комментарий</span><span>Действия</span>
        </div>
        ${filteredHistory.map((item) => `
          <div class="table-row">
            <span><strong>${item.match}</strong><small>${item.league}</small></span>
            <span>${patternTypeLabels[item.patternType]}</span>
            <span>${item.minute}'</span>
            <span>${item.score}</span>
            <span><b class="status-dot ${item.status}"></b>${statusLabels[item.status]}<small>${formatResult(item)}</small></span>
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
  const periodHistory = getHistoryByPeriod(state.history, state.statsPeriod);
  const journalStats = getJournalStats(periodHistory);
  const patternRows = state.patterns.map((pattern) => getPatternStats(pattern, periodHistory));

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
        <div class="analytics-table">
          <div class="analytics-head">
            <span>Паттерн</span><span>Сигналов</span><span>До 5</span><span>До 10</span><span>До 15</span><span>Не подтверждено</span><span>Pressure</span><span>Минута</span><span>Статус</span>
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
              <span><b class="quality-badge ${row.status}">${patternStatusLabels[row.status]}</b></span>
            </div>
          `).join("")}
        </div>
      </div>
      <aside class="panel">
        <h2>Сводка по статусам</h2>
        ${renderPatternStatusSummary(patternRows)}
      </aside>
    </section>
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

function renderProfile() {
  const profile = state.userProfile;
  const journalStats = getJournalStats(state.history);
  const trust = profile?.socialTrust || {};

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
        ${metric("Событий в журнале", journalStats.total)}
        ${metric("Win", journalStats.win)}
        ${metric("Lose", journalStats.lose)}
        ${metric("Уровень доверия", trust.score || 0)}
      </section>

      <section class="section-grid">
        <div class="panel">
          <div class="panel-heading">
            <div>
              <h2>Социальное доверие</h2>
              <p>${escapeHtml(trust.level || "Профиль в подготовке")}</p>
            </div>
            <span class="count-pill">${trust.score || 0}/100</span>
          </div>
          <div class="trust-meter"><span style="width: ${Math.min(100, trust.score || 0)}%"></span></div>
          <div class="readiness-list">
            <span><b>${trust.verifiedSignals || 0}</b> проверенных сигналов</span>
            <span><b>${trust.reviewedIdeas || 0}</b> разобранных идей</span>
            <span><b>${trust.sharedReports || 0}</b> публичных отчетов</span>
          </div>
          <div class="note-list">
            ${(trust.notes || []).map((note) => `<span>${escapeHtml(note)}</span>`).join("")}
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
    </section>
  `;
}

function renderIdeas() {
  const items = state.feedbackItems;
  const ideaCount = items.filter((item) => item.type === "idea").length;
  const feedbackCount = items.filter((item) => item.type === "feedback").length;
  const highPriority = items.filter((item) => item.priority === "high").length;

  return `
    <section>
      <section class="summary-grid">
        ${metric("Идей", ideaCount)}
        ${metric("Отклики", feedbackCount)}
        ${metric("Высокий приоритет", highPriority)}
        ${metric("Всего голосов", items.reduce((sum, item) => sum + item.votes, 0))}
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

function renderSettings() {
  const telegramStatus = state.settings.lastTelegramTest
    ? `<p class="telegram-status">${escapeHtml(state.settings.lastTelegramTest.message)}<span>${escapeHtml(state.settings.lastTelegramTest.channel)} · ${formatDateTime(state.settings.lastTelegramTest.createdAt)}</span></p>`
    : "";

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

function getTeamProfile(selection) {
  const match = state.matches.find((item) => item.id === selection.matchId);
  const snapshot = match ? getSnapshot(match.id) : null;
  if (!match || !snapshot) return null;

  const side = selection.side === "away" ? "away" : "home";
  const opponentSide = side === "home" ? "away" : "home";
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const opponentName = side === "home" ? match.awayTeam : match.homeTeam;
  const teamId = selection.teamId || (side === "home" ? match.homeTeamId : match.awayTeamId);
  const providerProfile = footballProvider.getTeamProfile?.(teamId);
  const stats = snapshot[side];
  const opponent = snapshot[opponentSide];
  const pressureScore = patternEngine.calculatePressureScore(stats);
  const signals = state.signals.filter((signal) => signal.matchId === match.id && signal.teamSide === side);
  const teamEvents = state.history.filter((event) => event.match?.includes(teamName));
  const history = getJournalStats(teamEvents);
  const pressureGap = pressureScore - patternEngine.calculatePressureScore(opponent);
  const trend = snapshot.recent?.[side]?.dangerousAttacks >= snapshot.previous?.[side]?.dangerousAttacks
    ? "темп растет"
    : "темп стабильный или ниже";

  return {
    ...(providerProfile || {}),
    id: teamId,
    name: teamName,
    match,
    stats,
    signals,
    history,
    pressureScore,
    summary: `${teamName} против ${opponentName}: ${stats.dangerousAttacks} опасных атак, ${stats.shotsTotal} ударов, ${stats.shotsOnTarget} в створ, ${stats.corners} угловых. Разница pressure score с соперником: ${pressureGap > 0 ? "+" : ""}${pressureGap}, ${trend}.`
  };
}

function getPatternStats(pattern, events) {
  const history = events.filter((item) => item.patternId === pattern.id);
  const totalSignals = history.length;
  const successWithin5 = history.filter((item) => item.result.goalWithin5).length;
  const successWithin10 = history.filter((item) => item.result.goalWithin10).length;
  const successWithin15 = history.filter((item) => item.result.goalWithin15).length;
  const failedSignals = history.filter((item) => getOutcome(item) === "lose").length;
  const pendingSignals = history.filter((item) => getOutcome(item) === "open").length;
  const successRate5 = getRate(successWithin5, totalSignals);
  const successRate10 = getRate(successWithin10, totalSignals);
  const successRate15 = getRate(successWithin15, totalSignals);
  const averageSignalMinute = getAverage(history.map((item) => item.minute));
  const averagePressureScore = getAverage(history.map((item) => item.pressureScore).filter(Boolean));
  const status = getPatternAnalyticsStatus({ pattern, totalSignals, successRate15 });

  return {
    pattern,
    history,
    totalSignals,
    successWithin5,
    successWithin10,
    successWithin15,
    failedSignals,
    pendingSignals,
    successRate5,
    successRate10,
    successRate15,
    averageSignalMinute,
    averagePressureScore,
    bestLeagues: getGroupedPatternStats(history, "league", "best"),
    weakLeagues: getGroupedPatternStats(history, "league", "weak"),
    bestTeams: getTeamPatternGroups(history, "best"),
    weakTeams: getTeamPatternGroups(history, "weak"),
    status,
    updatedAt: new Date().toISOString()
  };
}

function getPatternAnalyticsStatus({ pattern, totalSignals, successRate15 }) {
  if (pattern.analyticsStatus === "testing") return "testing";
  if (totalSignals < 30) return "new";
  if (totalSignals < 100 && successRate15 >= 35) return "promising";
  if (totalSignals >= 100 && successRate15 >= 35) return "working";
  if (totalSignals >= 100 && successRate15 >= 20) return "weak";
  if (totalSignals >= 100 && successRate15 < 20) return "ineffective";
  return "testing";
}

function getPatternStatusReason(stats) {
  if (stats.status === "new") return `Сигналов ${stats.totalSignals}. Нужна большая выборка.`;
  if (stats.status === "promising") return `До 15 минут ${stats.successRate15}%, выборка растет.`;
  if (stats.status === "working") return `До 15 минут ${stats.successRate15}%, выборка ${stats.totalSignals}.`;
  if (stats.status === "weak") return `До 15 минут ${stats.successRate15}%, стоит наблюдать условия.`;
  if (stats.status === "ineffective") return `До 15 минут ${stats.successRate15}%, паттерн требует пересмотра.`;
  return "Паттерн изменен или находится в ручной проверке.";
}

function getRate(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function getAverage(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length) : 0;
}

function getGroupedPatternStats(events, key, mode) {
  const groups = new Map();
  events.forEach((event) => {
    const name = event[key] || "Не указано";
    const group = groups.get(name) || { name, total: 0, successWithin15: 0, rate15: 0 };
    group.total += 1;
    if (event.result.goalWithin15) group.successWithin15 += 1;
    group.rate15 = getRate(group.successWithin15, group.total);
    groups.set(name, group);
  });
  const sorted = [...groups.values()].sort((a, b) => mode === "best" ? b.rate15 - a.rate15 : a.rate15 - b.rate15);
  return sorted.slice(0, 3);
}

function getTeamPatternGroups(events, mode) {
  const groups = new Map();
  events.forEach((event) => {
    const name = getEventTeamName(event);
    const group = groups.get(name) || { name, total: 0, successWithin15: 0, rate15: 0 };
    group.total += 1;
    if (event.result.goalWithin15) group.successWithin15 += 1;
    group.rate15 = getRate(group.successWithin15, group.total);
    groups.set(name, group);
  });
  const sorted = [...groups.values()].sort((a, b) => mode === "best" ? b.rate15 - a.rate15 : a.rate15 - b.rate15);
  return sorted.slice(0, 3);
}

function getEventTeamName(event) {
  const match = state.matches.find((item) => item.id === event.matchId);
  if (match && event.teamSide === "home") return match.homeTeam;
  if (match && event.teamSide === "away") return match.awayTeam;
  return event.match?.split(" - ")[0] || "Команда";
}

function getFilteredHistory() {
  return state.history.filter((event) => {
    if (state.historyFilter === "win") return getOutcome(event) === "win";
    if (state.historyFilter === "lose") return getOutcome(event) === "lose";
    if (state.historyFilter === "open") return getOutcome(event) === "open";
    return true;
  });
}

function getHistoryByPeriod(events, period) {
  if (period === "all") return events;

  const now = new Date();
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    start.setDate(start.getDate() - 7);
  }

  return events.filter((event) => new Date(event.createdAt).getTime() >= start.getTime());
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
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  const filename = `football-pattern-history-${state.historyFilter}-${timestamp}.${format}`;
  const content = format === "csv" ? historyToCsv(events) : JSON.stringify(events, null, 2);
  const type = format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
  downloadFile(filename, content, type);
}

function historyToCsv(events) {
  const headers = ["id", "matchId", "teamId", "match", "league", "minute", "pattern", "scoreHome", "scoreAway", "pressureScore", "strength", "outcome", "status", "goalWithin5", "goalWithin10", "goalWithin15", "goalMinute", "goalTeam", "finalComment", "createdAt", "updatedAt", "closedAt"];
  const rows = events.map((event) => [
    event.id,
    event.matchId,
    event.teamId,
    event.match,
    event.league,
    event.minute,
    patternTypeLabels[event.patternType] || event.patternType,
    event.scoreHome,
    event.scoreAway,
    event.pressureScore,
    event.strength,
    getOutcome(event),
    event.status,
    event.result.goalWithin5,
    event.result.goalWithin10,
    event.result.goalWithin15,
    event.result.goalMinute || "",
    event.result.goalTeam || "",
    event.result.finalComment || event.comment || "",
    event.createdAt,
    event.updatedAt || "",
    event.closedAt || ""
  ]);

  return `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
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
  const fallback = { startedAt: new Date().toISOString() };
  try {
    const stored = JSON.parse(localStorage.getItem(SERVICE_META_KEY) || "null");
    if (stored?.startedAt) {
      return stored;
    }
    localStorage.setItem(SERVICE_META_KEY, JSON.stringify(fallback));
    return fallback;
  } catch {
    return fallback;
  }
}

function readPatternEvents(seedEvents) {
  try {
    const stored = JSON.parse(localStorage.getItem(PATTERN_EVENTS_KEY) || "null");
    if (Array.isArray(stored) && stored.length > 0) {
      return stored.map(normalizePatternEvent).sort(sortEventsByTime);
    }
  } catch {}

  const seeded = seedEvents.map(normalizePatternEvent).sort(sortEventsByTime);
  localStorage.setItem(PATTERN_EVENTS_KEY, JSON.stringify(seeded));
  return seeded;
}

function writePatternEvents() {
  localStorage.setItem(PATTERN_EVENTS_KEY, JSON.stringify(state.history));
}

function syncActiveSignalsToJournal() {
  let changed = false;
  state.signals.forEach((signal) => {
    if (state.history.some((event) => event.id === signal.id)) {
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

function signalToJournalEvent(signal) {
  const match = state.matches.find((item) => item.id === signal.matchId);
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
    status: signal.status,
    result: {
      goalWithin5: false,
      goalWithin10: false,
      goalWithin15: false,
      goalMinute: null,
      goalTeam: null,
      finalComment: ""
    },
    comment: "",
    pressureScore: signal.pressureScore,
    strength: signal.strength,
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
  const total = events.length;
  const win = events.filter((event) => getOutcome(event) === "win").length;
  const lose = events.filter((event) => getOutcome(event) === "lose").length;
  const open = events.filter((event) => getOutcome(event) === "open").length;
  const closed = win + lose;

  return {
    startedAt: state.serviceMeta.startedAt,
    total,
    win,
    lose,
    open,
    winRate: closed ? Math.round((win / closed) * 100) : 0
  };
}

function getOutcome(event) {
  if (event.status === "success") return "win";
  if (event.status === "failed") return "lose";
  return "open";
}

function formatOutcome(event) {
  const outcome = getOutcome(event);
  if (outcome === "win") return "Win";
  if (outcome === "lose") return "Lose";
  return "В процессе";
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
  return patternEngine.evaluateAllMatches(state.matches, state.snapshots, state.patterns);
}

function getSnapshot(matchId) {
  return state.snapshots.find((snapshot) => snapshot.matchId === matchId);
}

function formatRule(rule) {
  const period = rule.period && rule.period !== "total" ? ` ${rule.period.replace("_", " ")}` : "";
  return `${rule.label || rule.field}${period} ${rule.operator} ${rule.value}`;
}

function formatResult(value) {
  const result = value?.result || value || {};
  if (result.manualOutcome === "win") return "Закрыто вручную: Win";
  if (result.manualOutcome === "lose") return "Закрыто вручную: Lose";
  if (result.goalWithin5) return "Гол до 5 мин";
  if (result.goalWithin10) return "Гол до 10 мин";
  if (result.goalWithin15) return "Гол до 15 мин";
  return "Гола нет";
}

function formatMatchResult(status) {
  const labels = {
    win: "Победа",
    draw: "Ничья",
    loss: "Поражение"
  };
  return labels[status] || status;
}

function formatImportance(reason) {
  const labels = {
    playoff: "плей-офф",
    final: "финал",
    derby: "дерби",
    top_opponent: "сильный соперник",
    must_win: "важный матч",
    relegation_race: "борьба внизу",
    title_race: "борьба за верх",
    manual: "отмечено вручную"
  };
  return labels[reason] || reason;
}

function formatTeamPatternLabel(label) {
  const labels = {
    strong: "strong",
    normal: "normal",
    weak: "weak",
    not_enough_data: "not enough data"
  };
  return labels[label] || label;
}

function profilePermissionLabel(status) {
  const labels = {
    active: "Готово",
    planned: "Дальше"
  };
  return labels[status] || status;
}

function feedbackStatusLabel(status) {
  const labels = {
    planned: "Запланировано",
    in_review: "На разборе",
    next: "Следующее"
  };
  return labels[status] || status;
}

function feedbackTypeLabel(type) {
  const labels = {
    idea: "Идея",
    feedback: "Отклик"
  };
  return labels[type] || type;
}

function feedbackPriorityLabel(priority) {
  const labels = {
    high: "высокий",
    medium: "средний",
    low: "низкий"
  };
  return labels[priority] || priority;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function readSettings() {
  const defaults = {
    mockMode: true,
    telegramEnabled: false,
    telegramChannel: "",
    lastTelegramTest: null,
    favoriteLeagues: ["Spain LaLiga", "Italy Serie A", "Portugal Primeira"]
  };

  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("football-pattern-lab-settings") || "{}") };
  } catch {
    return defaults;
  }
}

function writeSettings() {
  localStorage.setItem("football-pattern-lab-settings", JSON.stringify(state.settings));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
