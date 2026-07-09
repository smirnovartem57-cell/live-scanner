const DATA_MODE = "mock";
const SIGNAL_BUCKET_MINUTES = 10;

const navItems = [
  { id: "live", label: "Лайв", title: "Лайв-сканер" },
  { id: "signals", label: "Сигналы", title: "Активные сигналы" },
  { id: "patterns", label: "Паттерны", title: "Лаборатория паттернов" },
  { id: "history", label: "История", title: "История сигналов" },
  { id: "stats", label: "Статистика", title: "Статистика" },
  { id: "settings", label: "Настройки", title: "Настройки" }
];

const state = {
  view: "live",
  activeFilter: "all",
  activePatternId: "pressure_without_goal",
  settings: readSettings(),
  patterns: [],
  matches: [],
  snapshots: [],
  signals: [],
  history: []
};

const root = document.querySelector("#pageRoot");
const title = document.querySelector("#pageTitle");
const desktopNav = document.querySelector("#desktopNav");
const mobileNav = document.querySelector("#mobileNav");
const refreshButton = document.querySelector("#refreshButton");

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
  LOW: "НИЗК",
  MED: "СРЕД",
  HIGH: "ВЫС"
};

function init() {
  state.patterns = getMockPatterns();
  state.matches = getMockMatches();
  state.snapshots = getMockSnapshots();
  state.history = getMockHistory();
  state.signals = evaluateAllMatches();

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
        <p class="eyebrow">Демо-режим: ${DATA_MODE}</p>
        <h2>Онлайн-паттерны по live-статистике</h2>
      </div>
      <div class="refresh-note">Обновлено ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
    </section>

    ${renderSummary(stats)}
    ${renderFilterChips()}

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
  const successRate = history.length ? Math.round((history.filter((item) => item.status === "success").length / history.length) * 100) : 0;

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
        <div class="sparkline" aria-hidden="true">
          <span style="height: 28%"></span><span style="height: 44%"></span><span style="height: 52%"></span><span style="height: 61%"></span><span style="height: 48%"></span><span style="height: 72%"></span>
        </div>
      </aside>
    </section>
  `;
}

function renderHistory() {
  return `
    <section class="panel wide-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Архив</p>
          <h2>История сигналов</h2>
        </div>
        <span class="count-pill">${state.history.length}</span>
      </div>
      <div class="history-table">
        <div class="table-head">
          <span>Матч</span><span>Лига</span><span>Минута</span><span>Паттерн</span><span>Счет</span><span>Статус</span><span>Результат</span>
        </div>
        ${state.history.map((item) => `
          <div class="table-row">
            <span>${item.match}</span>
            <span>${item.league}</span>
            <span>${item.minute}'</span>
            <span>${patternTypeLabels[item.patternType]}</span>
            <span>${item.score}</span>
            <span><b class="status-dot ${item.status}"></b>${statusLabels[item.status]}</span>
            <span>${formatResult(item.result)}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderStats() {
  const totals = getDashboardStats();
  const patternRows = state.patterns.map((pattern) => {
    const history = state.history.filter((item) => item.patternId === pattern.id);
    const active = state.signals.filter((signal) => signal.patternId === pattern.id).length;
    const success = history.filter((item) => item.status === "success").length;
    const rate = history.length ? Math.round((success / history.length) * 100) : 0;
    return { pattern, history, active, rate };
  });

  return `
    ${renderSummary(totals)}
    <section class="section-grid">
      <div class="panel wide-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Аналитика</p>
            <h2>Паттерны и лиги</h2>
          </div>
        </div>
        ${patternRows.map((row) => `
          <div class="stat-line">
            <div>
              <strong>${row.pattern.name}</strong>
              <span>${row.history.length} в истории, ${row.active} активно</span>
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
          <span>Демо-режим</span>
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
  getMatchEvents(matchId)</pre>
      </div>
    </section>
  `;
}

function renderSummary(stats) {
  return `
    <section class="summary-grid">
      ${metric("Лайв-матчи", stats.liveMatches)}
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
    ["mine", "Мои"]
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
        <span class="live-pill">${match.status === "halftime" ? "Перерыв" : "Лайв"}</span>
        <span>${match.minute}'</span>
        <span>${match.league}</span>
      </div>
      <div class="scoreboard">
        <strong>${match.homeTeam}</strong>
        <b>${match.scoreHome}:${match.scoreAway}</b>
        <strong>${match.awayTeam}</strong>
      </div>
      <div class="pattern-callout">
        <div>
          <p>${mainSignal ? patternTypeLabels[mainSignal.patternType] : "Паттерн не обнаружен"}</p>
          <span>${mainSignal ? "Обнаружен паттерн" : "Идет наблюдение"}</span>
        </div>
        <span class="pressure-badge ${getSignalStrength(pressure).toLowerCase()}">${pressure}</span>
      </div>
      <div class="stat-grid compact">
        ${statMetric("Опасные", snapshot.home.dangerousAttacks, snapshot.away.dangerousAttacks)}
        ${statMetric("Удары", snapshot.home.shotsTotal, snapshot.away.shotsTotal)}
        ${statMetric("В створ", snapshot.home.shotsOnTarget, snapshot.away.shotsOnTarget)}
        ${statMetric("Угловые", snapshot.home.corners, snapshot.away.corners)}
        ${statMetric("xG", snapshot.home.xg.toFixed(2), snapshot.away.xg.toFixed(2))}
      </div>
      <div class="trend-row">
        <span>Тренд: ${snapshot.recent.home.dangerousAttacks >= snapshot.previous.home.dangerousAttacks ? "рост активности хозяев" : "спокойнее"}</span>
        <span class="strength ${mainSignal ? mainSignal.strength.toLowerCase() : "low"}">${mainSignal ? strengthLabels[mainSignal.strength] : strengthLabels.LOW}</span>
      </div>
    </article>
  `;
}

function renderCompactSignal(signal) {
  const match = state.matches.find((item) => item.id === signal.matchId);
  return `
    <article class="compact-signal">
      <div>
        <strong>${patternTypeLabels[signal.patternType]}</strong>
        <span>${match.homeTeam} - ${match.awayTeam}, ${signal.minute}'</span>
      </div>
      <span class="strength ${signal.strength.toLowerCase()}">${signal.strength}</span>
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

function renderEmpty(text) {
  return `<div class="empty-state">${text}</div>`;
}

function getFilteredMatches() {
  return state.matches.filter((match) => {
    if (state.activeFilter === "scoreless") return match.scoreHome + match.scoreAway === 0;
    if (state.activeFilter === "late") return match.minute >= 60;
    if (state.activeFilter === "top") return match.isTopLeague;
    if (state.activeFilter === "mine") return state.settings.favoriteLeagues.includes(match.league);
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

function getSnapshot(matchId) {
  return state.snapshots.find((snapshot) => snapshot.matchId === matchId);
}

function formatRule(rule) {
  const period = rule.period && rule.period !== "total" ? ` ${rule.period.replace("_", " ")}` : "";
  return `${rule.label || rule.field}${period} ${rule.operator} ${rule.value}`;
}

function formatResult(result) {
  if (result.goalWithin5) return "Гол до 5 мин";
  if (result.goalWithin10) return "Гол до 10 мин";
  if (result.goalWithin15) return "Гол до 15 мин";
  return "Гола нет";
}

function readSettings() {
  const defaults = {
    mockMode: true,
    telegramEnabled: false,
    telegramChannel: "",
    favoriteLeagues: ["Portugal Liga 2", "Japan J2 League", "Sweden Superettan"]
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

function getMockPatterns() {
  return [
    {
      id: "pressure_without_goal",
      name: "Давят без гола",
      description: "Команда создает давление, но счет остается без голов.",
      enabled: true,
      type: "pressure_without_goal",
      rules: [
        { label: "Минута", field: "minute", operator: ">=", value: 25 },
        { label: "Минута", field: "minute", operator: "<=", value: 70 },
        { label: "Счет", field: "scoreTotal", operator: "==", value: 0 },
        { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: 50 },
        { label: "Удары", field: "shotsTotal", operator: ">=", value: 8 },
        { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 70 }
      ]
    },
    {
      id: "late_goal",
      name: "Поздний гол",
      description: "После 65-й минуты давление растет при небольшой разнице в счете.",
      enabled: true,
      type: "late_goal",
      rules: [
        { label: "Минута", field: "minute", operator: ">=", value: 65 },
        { label: "Разница счета", field: "scoreDiff", operator: "<=", value: 1 },
        { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: 45 },
        { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 65 }
      ]
    },
    {
      id: "match_woke_up",
      name: "Матч ожил",
      description: "Темп последних минут заметно выше предыдущего отрезка.",
      enabled: true,
      type: "match_woke_up",
      rules: [
        { label: "Минута", field: "minute", operator: ">=", value: 30 },
        { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: "previous * 1.7", period: "last_10" },
        { label: "Удары", field: "shotsTotal", operator: ">=", value: 2, period: "last_10" },
        { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 60 }
      ]
    },
    {
      id: "favorite_losing_but_pressing",
      name: "Проигрывает, но давит",
      description: "Команда уступает в счете, но превосходит соперника по давлению.",
      enabled: true,
      type: "favorite_losing_but_pressing",
      rules: [
        { label: "Команда", field: "teamLosing", operator: "==", value: "true" },
        { label: "Опасные атаки", field: "dangerousRatio", operator: ">=", value: "x1.6" },
        { label: "Удары", field: "shotsRatio", operator: ">=", value: "x1.4" },
        { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 65 }
      ]
    },
    {
      id: "corner_pressure",
      name: "Давление на угловой",
      description: "Атаки, опасные атаки и угловые идут плотным потоком.",
      enabled: true,
      type: "corner_pressure",
      rules: [
        { label: "Минута", field: "minute", operator: ">=", value: 20 },
        { label: "Атаки", field: "attacks", operator: ">=", value: 60 },
        { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: 40 },
        { label: "Угловые", field: "corners", operator: ">=", value: 4 }
      ]
    },
    {
      id: "empty_pressure",
      name: "Пустое давление",
      description: "Много общего давления, но мало реальной остроты.",
      enabled: true,
      type: "empty_pressure",
      rules: [
        { label: "Атаки", field: "attacks", operator: ">=", value: 70 },
        { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: 45 },
        { label: "В створ", field: "shotsOnTarget", operator: "<=", value: 1 },
        { label: "Угловые", field: "corners", operator: "<=", value: 2 }
      ]
    }
  ];
}

function getMockMatches() {
  const now = new Date().toISOString();
  return [
    { id: "m1", league: "Portugal Liga 2", country: "Portugal", homeTeam: "Leiria", awayTeam: "Tondela", minute: 64, status: "live", scoreHome: 0, scoreAway: 0, isTopLeague: false, updatedAt: now },
    { id: "m2", league: "Sweden Superettan", country: "Sweden", homeTeam: "Orebro", awayTeam: "Vasteras", minute: 73, status: "live", scoreHome: 1, scoreAway: 1, isTopLeague: false, updatedAt: now },
    { id: "m3", league: "Brazil Serie B", country: "Brazil", homeTeam: "Avai", awayTeam: "Goias", minute: 45, status: "halftime", scoreHome: 0, scoreAway: 1, isTopLeague: false, updatedAt: now },
    { id: "m4", league: "Japan J2 League", country: "Japan", homeTeam: "Kofu", awayTeam: "Iwaki", minute: 82, status: "live", scoreHome: 1, scoreAway: 2, isTopLeague: false, updatedAt: now },
    { id: "m5", league: "Spain LaLiga", country: "Spain", homeTeam: "Valencia", awayTeam: "Betis", minute: 68, status: "live", scoreHome: 0, scoreAway: 0, isTopLeague: true, updatedAt: now }
  ];
}

function getMockSnapshots() {
  return [
    snapshot("s1", "m1", 64, team(78, 56, 15, 6, 9, 58, 1.62), team(39, 13, 4, 1, 2, 42, 0.28), team(19, 15, 4, 2, 3, 61, 0.49), team(12, 6, 1, 0, 1, 39, 0.08)),
    snapshot("s2", "m2", 73, team(61, 29, 9, 3, 4, 49, 0.98), team(67, 36, 11, 5, 6, 51, 1.21), team(12, 10, 3, 1, 2, 48, 0.32), team(7, 5, 1, 1, 1, 52, 0.14)),
    snapshot("s3", "m3", 45, team(31, 11, 3, 1, 1, 45, 0.22), team(48, 26, 8, 4, 5, 55, 0.91), team(6, 3, 1, 0, 0, 45, 0.05), team(8, 5, 2, 1, 1, 55, 0.18)),
    snapshot("s4", "m4", 82, team(86, 51, 13, 5, 10, 57, 1.58), team(52, 21, 7, 3, 3, 43, 0.77), team(24, 18, 5, 2, 4, 59, 0.58), team(9, 4, 1, 0, 1, 41, 0.11)),
    snapshot("s5", "m5", 68, team(74, 52, 10, 3, 5, 54, 1.06), team(34, 17, 5, 1, 2, 46, 0.36), team(17, 14, 3, 1, 2, 54, 0.3), team(8, 5, 1, 0, 1, 46, 0.09))
  ];
}

function snapshot(id, matchId, minute, home, away, recentHome, previousHome) {
  return {
    id,
    matchId,
    minute,
    createdAt: new Date().toISOString(),
    home,
    away,
    recent: {
      home: recentHome,
      away: {
        attacks: Math.max(3, Math.round(away.attacks * 0.14)),
        dangerousAttacks: Math.max(2, Math.round(away.dangerousAttacks * 0.18)),
        shotsTotal: Math.max(1, Math.round(away.shotsTotal * 0.2)),
        shotsOnTarget: Math.max(0, Math.round(away.shotsOnTarget * 0.2)),
        corners: Math.max(0, Math.round(away.corners * 0.2)),
        possession: away.possession,
        xg: Number((away.xg * 0.18).toFixed(2))
      }
    },
    previous: {
      home: previousHome,
      away: {
        attacks: Math.max(3, Math.round(away.attacks * 0.12)),
        dangerousAttacks: Math.max(2, Math.round(away.dangerousAttacks * 0.14)),
        shotsTotal: Math.max(1, Math.round(away.shotsTotal * 0.15)),
        shotsOnTarget: Math.max(0, Math.round(away.shotsOnTarget * 0.15)),
        corners: Math.max(0, Math.round(away.corners * 0.15)),
        possession: away.possession,
        xg: Number((away.xg * 0.12).toFixed(2))
      }
    }
  };
}

function team(attacks, dangerousAttacks, shotsTotal, shotsOnTarget, corners, possession, xg) {
  return { attacks, dangerousAttacks, shotsTotal, shotsOnTarget, corners, possession, xg };
}

function getMockHistory() {
  return [
    history("Barcelona - Valencia", "Spain LaLiga", 62, "pressure_without_goal", "pressure_without_goal", "0:0", "success", { goalWithin5: false, goalWithin10: true, goalWithin15: true }),
    history("Kofu - Oita", "Japan J2 League", 78, "late_goal", "late_goal", "1:1", "success", { goalWithin5: true, goalWithin10: true, goalWithin15: true }),
    history("Avai - Ceara", "Brazil Serie B", 54, "empty_pressure", "empty_pressure", "0:0", "failed", { goalWithin5: false, goalWithin10: false, goalWithin15: false }),
    history("Leiria - Mafra", "Portugal Liga 2", 66, "corner_pressure", "corner_pressure", "1:1", "in_progress", { goalWithin5: false, goalWithin10: false, goalWithin15: false }),
    history("Orebro - Utsikten", "Sweden Superettan", 71, "match_woke_up", "match_woke_up", "0:1", "success", { goalWithin5: false, goalWithin10: false, goalWithin15: true })
  ];
}

function history(match, league, minute, patternId, patternType, score, status, result) {
  return { match, league, minute, patternId, patternType, score, status, result };
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
