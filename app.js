const SIGNAL_BUCKET_MINUTES = 10;
const SERVICE_META_KEY = "football-pattern-lab-service-meta";
const PATTERN_EVENTS_KEY = "football-pattern-lab-pattern-events";
const footballProvider = window.FootballDataProvider.createMockFootballProvider();

const navItems = [
  { id: "live", label: "Матчи", title: "Сканер матчей" },
  { id: "signals", label: "Сигналы", title: "Активные сигналы" },
  { id: "patterns", label: "Паттерны", title: "Лаборатория паттернов" },
  { id: "history", label: "История", title: "История паттернов" },
  { id: "stats", label: "Статистика", title: "Статистика" },
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
  selectedTeam: null,
  serviceMeta: readServiceMeta()
};

const root = document.querySelector("#pageRoot");
const title = document.querySelector("#pageTitle");
const desktopNav = document.querySelector("#desktopNav");
const mobileNav = document.querySelector("#mobileNav");
const refreshButton = document.querySelector("#refreshButton");

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

function init() {
  state.patterns = footballProvider.getPatterns();
  state.matches = footballProvider.getLiveMatches();
  state.snapshots = footballProvider.getMatchStats();
  state.history = readPatternEvents(footballProvider.getSeedHistory());
  state.signals = evaluateAllMatches();
  syncActiveSignalsToJournal();

  bindNavigation();
  refreshButton.addEventListener("click", refreshMockData);
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
      updatePatternEvent(input.dataset.commentEvent, { comment: input.value });
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
      state.signals = evaluateAllMatches();
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
    testTelegram.addEventListener("click", () => {
      testTelegram.textContent = "Тестовое сообщение подготовлено";
      testTelegram.disabled = true;
      setTimeout(() => {
        testTelegram.textContent = "Отправить тестовое сообщение";
        testTelegram.disabled = false;
      }, 1600);
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
  const patternSignals = state.signals.filter((signal) => signal.patternId === activePattern.id);
  const history = state.history.filter((item) => item.patternId === activePattern.id);
  const win = history.filter((item) => getOutcome(item) === "win").length;
  const lose = history.filter((item) => getOutcome(item) === "lose").length;
  const closed = win + lose;
  const successRate = closed ? Math.round((win / closed) * 100) : 0;
  const quality = getPatternQuality({ closed, rate: successRate, open: history.filter((item) => getOutcome(item) === "open").length });

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
          ${metric("Срабатываний", patternSignals.length + history.length)}
          ${metric("Гол до 10 мин", `${history.filter((item) => item.result.goalWithin10).length}`)}
          ${metric("Гол до 15 мин", `${history.filter((item) => item.result.goalWithin15).length}`)}
          ${metric("Эффективность", `${successRate}%`)}
        </div>
        <div class="quality-note ${quality.level}">
          <strong>${quality.label}</strong>
          <span>${quality.reason}</span>
        </div>
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
  const patternRows = state.patterns.map((pattern) => {
    const history = periodHistory.filter((item) => item.patternId === pattern.id);
    const active = state.signals.filter((signal) => signal.patternId === pattern.id).length;
    const win = history.filter((item) => getOutcome(item) === "win").length;
    const lose = history.filter((item) => getOutcome(item) === "lose").length;
    const open = history.filter((item) => getOutcome(item) === "open").length;
    const closed = win + lose;
    const rate = closed ? Math.round((win / closed) * 100) : 0;
    const quality = getPatternQuality({ closed, rate, open });
    return { pattern, history, active, win, lose, open, rate, quality };
  });

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
            <h2>Паттерны и лиги</h2>
          </div>
        </div>
        ${patternRows.map((row) => `
          <div class="stat-line ${row.quality.level}">
            <div>
              <strong>${row.pattern.name} <span class="quality-badge ${row.quality.level}">${row.quality.label}</span></strong>
              <span>${row.history.length} событий · win ${row.win} · lose ${row.lose} · в процессе ${row.open}</span>
              <small>${row.quality.reason}</small>
            </div>
            <div class="progress"><span style="width: ${row.rate}%"></span></div>
            <b>${row.rate}%</b>
          </div>
        `).join("")}
      </div>
      <aside class="panel">
        <h2>Качество лиг</h2>
        <div class="league-list">
          <span>Portugal Liga 2 <b>чистые сигналы</b></span>
          <span>Japan J2 League <b>поздняя активность</b></span>
          <span>Brazil Serie B <b>много шума</b></span>
        </div>
      </aside>
    </section>
  `;
}

function renderSettings() {
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
      </div>

      <div class="panel">
        <h2>API-адаптер</h2>
        <pre class="code-block">FootballDataProvider
  getLiveMatches()
  getMatchStats(matchId)
  getMatchEvents(matchId)
  getTeamProfile(teamId)</pre>
        <p class="muted">Интерфейс оставлен независимым от поставщика данных, чтобы позже заменить demo-данные на реальный football API.</p>
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
  const homePressure = calculatePressureScore(snapshot.home);
  const awayPressure = calculatePressureScore(snapshot.away);
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
          <span class="strength ${mainSignal ? mainSignal.strength.toLowerCase() : getSignalStrength(pressure).toLowerCase()}">${mainSignal ? mainSignal.strength : getSignalStrength(pressure)}</span>
          <span class="pressure-badge ${getSignalStrength(pressure).toLowerCase()}">${pressure}</span>
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

  return `
    <section class="team-profile-panel">
      <div class="team-profile-header">
        <div>
          <p class="eyebrow">Профиль команды</p>
          <h2>${profile.name}</h2>
          <span>${profile.match.homeTeam} - ${profile.match.awayTeam} · ${profile.match.league}</span>
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
    calculatePressureScore(snapshot.home),
    calculatePressureScore(snapshot.away)
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
  const pressureScore = calculatePressureScore(stats);
  const signals = state.signals.filter((signal) => signal.matchId === match.id && signal.teamSide === side);
  const teamEvents = state.history.filter((event) => event.match?.includes(teamName));
  const history = getJournalStats(teamEvents);
  const pressureGap = pressureScore - calculatePressureScore(opponent);
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

function getPatternQuality({ closed, rate, open }) {
  if (closed < 3) {
    return {
      level: "sample",
      label: "Мало данных",
      reason: `Закрыто ${closed} событий. Нужна история, чтобы честно оценить паттерн.`
    };
  }

  if (rate < 40) {
    return {
      level: "weak",
      label: "Слабый",
      reason: `Win rate ${rate}%. Паттерн стоит пересмотреть или ужесточить условия.`
    };
  }

  if (rate < 58 || open > closed) {
    return {
      level: "watch",
      label: "Наблюдать",
      reason: `Win rate ${rate}%, открытых событий ${open}. Паттерн требует наблюдения.`
    };
  }

  return {
    level: "strong",
    label: "Стабильный",
    reason: `Win rate ${rate}%. Паттерн пока выглядит устойчиво.`
  };
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
  state.history = state.history.map((event) => event.id === id ? normalizePatternEvent({ ...event, ...patch }) : event);
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
      manualOutcome: outcome
    },
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
  const headers = ["id", "match", "league", "minute", "pattern", "score", "outcome", "status", "comment", "createdAt", "closedAt"];
  const rows = events.map((event) => [
    event.id,
    event.match,
    event.league,
    event.minute,
    patternTypeLabels[event.patternType] || event.patternType,
    event.score,
    getOutcome(event),
    event.status,
    event.comment || "",
    event.createdAt,
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
    teamSide: signal.teamSide,
    score: `${signal.scoreHome}:${signal.scoreAway}`,
    status: signal.status,
    result: { goalWithin5: false, goalWithin10: false, goalWithin15: false },
    comment: "",
    pressureScore: signal.pressureScore,
    strength: signal.strength,
    explanation: signal.explanation,
    createdAt: signal.createdAt,
    closedAt: null
  };
}

function normalizePatternEvent(event) {
  const normalized = {
    id: event.id || `${event.match}-${event.patternId}-${event.minute}-${event.score}`.replaceAll(" ", "-"),
    match: event.match,
    matchId: event.matchId || "",
    league: event.league,
    minute: event.minute,
    patternId: event.patternId,
    patternType: event.patternType,
    teamSide: event.teamSide || "both",
    score: event.score,
    status: event.status,
    result: event.result || { goalWithin5: false, goalWithin10: false, goalWithin15: false },
    comment: event.comment || "",
    pressureScore: event.pressureScore || null,
    strength: event.strength || null,
    explanation: event.explanation || "Событие добавлено в журнал до появления подробных объяснений.",
    createdAt: event.createdAt || event.occurredAt || state.serviceMeta.startedAt,
    closedAt: event.closedAt || null
  };

  return normalized;
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
  state.signals = evaluateAllMatches();
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

function evaluateAllMatches() {
  const signals = [];
  state.matches.filter((match) => match.status === "live" || match.status === "halftime").forEach((match) => {
    const snapshot = getSnapshot(match.id);
    state.patterns.filter((pattern) => pattern.enabled).forEach((pattern) => {
      ["home", "away"].forEach((side) => {
        const signal = evaluatePattern(match, snapshot, pattern, side);
        if (signal && !hasDuplicateSignal(signals, signal)) {
          signals.push(signal);
        }
      });
    });
  });
  return signals.sort((a, b) => b.pressureScore - a.pressureScore);
}

function evaluatePattern(match, snapshot, pattern, side) {
  const team = snapshot[side];
  const opponent = snapshot[side === "home" ? "away" : "home"];
  const pressureScore = calculatePressureScore(team);
  const scoreDifference = Math.abs(match.scoreHome - match.scoreAway);
  const teamIsLosing = side === "home" ? match.scoreHome < match.scoreAway : match.scoreAway < match.scoreHome;
  const recent = snapshot.recent?.[side] || team;
  const previous = snapshot.previous?.[side] || team;

  const checks = {
    pressure_without_goal:
      match.minute >= 25 &&
      match.minute <= 70 &&
      match.scoreHome + match.scoreAway === 0 &&
      team.dangerousAttacks >= 50 &&
      team.shotsTotal >= 8 &&
      team.shotsOnTarget >= 2 &&
      team.corners >= 3 &&
      pressureScore >= 70,
    late_goal:
      match.minute >= 65 &&
      scoreDifference <= 1 &&
      team.dangerousAttacks >= 45 &&
      team.shotsTotal >= 7 &&
      pressureScore >= 65,
    favorite_losing_but_pressing:
      teamIsLosing &&
      team.dangerousAttacks >= opponent.dangerousAttacks * 1.6 &&
      team.shotsTotal >= opponent.shotsTotal * 1.4 &&
      pressureScore >= 65,
    match_woke_up:
      match.minute >= 30 &&
      recent.dangerousAttacks >= previous.dangerousAttacks * 1.7 &&
      recent.shotsTotal >= 2 &&
      pressureScore >= 60,
    corner_pressure:
      match.minute >= 20 &&
      team.attacks >= 60 &&
      team.dangerousAttacks >= 40 &&
      team.corners >= 4,
    empty_pressure:
      team.attacks >= 70 &&
      team.dangerousAttacks >= 45 &&
      team.shotsOnTarget <= 1 &&
      team.corners <= 2
  };

  if (!checks[pattern.type]) {
    return null;
  }

  return {
    id: `${match.id}-${pattern.id}-${side}-${Math.floor(match.minute / SIGNAL_BUCKET_MINUTES)}`,
    matchId: match.id,
    patternId: pattern.id,
    patternType: pattern.type,
    teamSide: side,
    minute: match.minute,
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
    pressureScore,
    strength: getSignalStrength(pressureScore),
    status: pattern.type === "empty_pressure" ? "new" : "in_progress",
    explanation: buildSignalExplanation(pattern.type, match, team, opponent, side, pressureScore, recent, previous),
    createdAt: new Date().toISOString()
  };
}

function hasDuplicateSignal(signals, candidate) {
  return signals.some((signal) =>
    signal.matchId === candidate.matchId &&
    signal.patternId === candidate.patternId &&
    signal.teamSide === candidate.teamSide &&
    Math.floor(signal.minute / SIGNAL_BUCKET_MINUTES) === Math.floor(candidate.minute / SIGNAL_BUCKET_MINUTES)
  );
}

function calculatePressureScore(stats) {
  const xgScore = typeof stats.xg === "number" ? stats.xg * 15 : 0;
  const score =
    stats.dangerousAttacks * 0.8 +
    stats.shotsTotal * 3 +
    stats.shotsOnTarget * 6 +
    stats.corners * 4 +
    xgScore;

  return Math.min(100, Math.round(score));
}

function getSignalStrength(score) {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MED";
  return "LOW";
}

function buildSignalExplanation(type, match, team, opponent, side, pressureScore, recent, previous) {
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const opponentName = side === "home" ? match.awayTeam : match.homeTeam;
  const score = `${match.scoreHome}:${match.scoreAway}`;
  const dangerousRatio = opponent.dangerousAttacks ? (team.dangerousAttacks / opponent.dangerousAttacks).toFixed(1) : "∞";
  const shotsRatio = opponent.shotsTotal ? (team.shotsTotal / opponent.shotsTotal).toFixed(1) : "∞";
  const recentGrowth = previous.dangerousAttacks ? Math.round((recent.dangerousAttacks / previous.dangerousAttacks) * 100) : 0;

  const explanations = {
    pressure_without_goal:
      `${teamName}: счет ${score}, ${team.dangerousAttacks} опасных атак, ${team.shotsTotal} ударов, ${team.corners} угловых, индекс давления ${pressureScore}. Давление есть, голов пока нет.`,
    late_goal:
      `${teamName}: ${match.minute}-я минута, разница в счете не больше одного мяча, ${team.dangerousAttacks} опасных атак и индекс давления ${pressureScore}. Матч остается активным в поздней фазе.`,
    favorite_losing_but_pressing:
      `${teamName} уступает в счете, но давит сильнее ${opponentName}: опасные атаки x${dangerousRatio}, удары x${shotsRatio}, индекс давления ${pressureScore}.`,
    match_woke_up:
      `${teamName}: последние 10 минут заметно активнее предыдущего отрезка, рост опасных атак до ${recentGrowth}%, ударов за отрезок ${recent.shotsTotal}, индекс давления ${pressureScore}.`,
    corner_pressure:
      `${teamName}: ${team.attacks} атак, ${team.dangerousAttacks} опасных атак и ${team.corners} угловых. Команда регулярно доводит атаки до давления у ворот.`,
    empty_pressure:
      `${teamName}: атак много (${team.attacks}), опасных атак ${team.dangerousAttacks}, но ударов в створ ${team.shotsOnTarget} и угловых ${team.corners}. Давление может быть низкого качества.`
  };

  return explanations[type] || `${teamName}: найдено совпадение с условиями паттерна, индекс давления ${pressureScore}.`;
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

function formatDate(value) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
}

function readSettings() {
  const defaults = {
    mockMode: true,
    telegramEnabled: false,
    telegramChannel: "",
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
