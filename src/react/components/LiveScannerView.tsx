import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { calculatePressureScore } from "../../services/patternEngine";
import type { Match, MatchStatsSnapshot, TeamSide } from "../../types/football";
import type { PatternEvent, Signal } from "../../types/patterns";
import type { TeamProfileSelection } from "../domain/teamProfile";
import { getPatternName } from "../domain/labels";
import type { ReactViewId } from "../types";

type LiveScannerViewProps = {
  matches: Match[];
  snapshots: MatchStatsSnapshot[];
  signals: Signal[];
  history: PatternEvent[];
  summary: {
    matchesCount: number;
    activeSignalsCount: number;
    highSignalsCount: number;
    patternsCount: number;
  };
  refreshing: boolean;
  onRefresh: () => void;
  onNavigate: (viewId: ReactViewId) => void;
  onTeamSelect: (selection: TeamProfileSelection) => void;
};

type ScannerFilter = "all" | "signals" | "high" | "favorites";
type ConfidenceLevel = "high" | "medium" | "low" | "unknown";
type Confidence = { level: ConfidenceLevel; label: string; percent: number | null; sample: number };
type MatchRow = {
  match: Match;
  snapshot?: MatchStatsSnapshot;
  signals: Signal[];
  mainSignal?: Signal;
  index: number;
  confidence: Confidence;
};

const favoritesKey = "live-scanner-favorite-matches";

export function LiveScannerView({
  matches,
  snapshots,
  signals,
  history,
  summary,
  refreshing,
  onRefresh,
  onNavigate,
  onTeamSelect
}: LiveScannerViewProps) {
  const [activeFilter, setActiveFilter] = useState<ScannerFilter>("all");
  const [league, setLeague] = useState("all");
  const [minuteRange, setMinuteRange] = useState("all");
  const [minimumIndex, setMinimumIndex] = useState(0);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  useEffect(() => {
    localStorage.setItem(favoritesKey, JSON.stringify(favorites));
  }, [favorites]);

  const rows = useMemo(() => buildRows(matches, snapshots, signals, history), [history, matches, signals, snapshots]);
  const leagues = useMemo(() => [...new Set(matches.map((match) => match.league))].sort(), [matches]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (activeFilter === "signals" && !row.mainSignal) return false;
    if (activeFilter === "high" && row.index < 70) return false;
    if (activeFilter === "favorites" && !favorites.includes(row.match.id)) return false;
    if (league !== "all" && row.match.league !== league) return false;
    if (minuteRange === "early" && row.match.minute > 30) return false;
    if (minuteRange === "middle" && (row.match.minute <= 30 || row.match.minute > 60)) return false;
    if (minuteRange === "late" && row.match.minute <= 60) return false;
    return row.index >= minimumIndex;
  }), [activeFilter, favorites, league, minimumIndex, minuteRange, rows]);
  const priorityRows = rows.filter((row) => row.mainSignal).slice(0, 4);
  const currentPatternTypes = new Set(rows.flatMap((row) => row.signals.map(patternTypeOf)));
  const highIndexCount = rows.filter((row) => row.index >= 70).length;
  const confidenceCounts = countConfidence(rows);
  const recentSignals = signals.filter((signal) => Date.now() - new Date(signal.createdAt).getTime() <= 15 * 60 * 1000).length;
  const topPatterns = getTopPatterns(signals);

  function toggleFavorite(matchId: string) {
    setFavorites((current) => current.includes(matchId)
      ? current.filter((item) => item !== matchId)
      : [...current, matchId]);
  }

  function exportSnapshot() {
    const content = JSON.stringify({
      exportedAt: new Date().toISOString(),
      matches: filteredRows.map((row) => row.match),
      signals: filteredRows.flatMap((row) => row.signals)
    }, null, 2);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    link.download = `live-scanner-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="scanner-dashboard">
      <section className="scanner-priority-panel" aria-labelledby="priority-heading">
        <div className="scanner-section-heading">
          <div>
            <p className="eyebrow">Главный live-фокус</p>
            <h2 id="priority-heading">Приоритетные паттерны</h2>
            <span>Матчи с наиболее выраженными текущими взаимосвязями</span>
          </div>
          <button className="scanner-link-button" type="button" onClick={() => onNavigate("signals")}>Все сигналы →</button>
        </div>
        {priorityRows.length ? (
          <div className="priority-pattern-grid">
            {priorityRows.map((row) => (
              <PriorityPatternCard row={row} key={`${row.match.id}-${row.mainSignal?.id}`} onTeamSelect={onTeamSelect} />
            ))}
          </div>
        ) : (
          <div className="scanner-empty-inline">
            <strong>Приоритетных паттернов пока нет</strong>
            <span>Матчи остаются в наблюдении; блок обновится после появления подтверждённых условий.</span>
          </div>
        )}
      </section>

      <section className="scanner-kpi-grid" aria-label="Live показатели">
        <ScannerKpi icon="◉" label="Матчи live" value={summary.matchesCount} note="доступно сейчас" />
        <ScannerKpi icon="ϟ" label="С паттернами" value={rows.filter((row) => row.mainSignal).length} note={`${summary.activeSignalsCount} сигналов`} />
        <ScannerKpi icon="◇" label="Высокий индекс" value={highIndexCount} note="индекс от 70" />
        <ScannerKpi icon="◎" label="Активных паттернов" value={currentPatternTypes.size} note={`${summary.patternsCount} включено`} />
      </section>

      <section className="scanner-filter-bar" aria-label="Фильтры матчей">
        <div className="scanner-primary-filters">
          <FilterButton active={activeFilter === "all"} onClick={() => setActiveFilter("all")}>Все матчи</FilterButton>
          <FilterButton active={activeFilter === "signals"} onClick={() => setActiveFilter("signals")}>С паттернами</FilterButton>
          <FilterButton active={activeFilter === "high"} onClick={() => setActiveFilter("high")}>Высокий индекс</FilterButton>
          <FilterButton active={activeFilter === "favorites"} onClick={() => setActiveFilter("favorites")}>Избранные</FilterButton>
        </div>
        <div className="scanner-select-filters">
          <label>
            <span>Лига</span>
            <select value={league} onChange={(event) => setLeague(event.target.value)}>
              <option value="all">Все лиги</option>
              {leagues.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Минута</span>
            <select value={minuteRange} onChange={(event) => setMinuteRange(event.target.value)}>
              <option value="all">Любая</option>
              <option value="early">0–30</option>
              <option value="middle">31–60</option>
              <option value="late">61+</option>
            </select>
          </label>
          <label>
            <span>Индекс</span>
            <select value={minimumIndex} onChange={(event) => setMinimumIndex(Number(event.target.value))}>
              <option value={0}>Любой</option>
              <option value={40}>40+</option>
              <option value={60}>60+</option>
              <option value={70}>70+</option>
            </select>
          </label>
        </div>
      </section>

      <div className="scanner-workspace">
        <section className="scanner-match-panel">
          <div className="scanner-section-heading compact">
            <div>
              <p className="eyebrow">Рабочая лента</p>
              <h2>Матчи live</h2>
            </div>
            <span className="scanner-result-count">{filteredRows.length} из {rows.length}</span>
          </div>
          <div className="scanner-match-table" role="table" aria-label="Live матчи">
            <div className="scanner-table-head" role="row">
              <span>Лига</span><span>Матч</span><span>Счёт</span><span>Минута</span><span>Индекс</span><span>Паттерн</span><span>Подтверждение</span><span aria-label="Избранное">★</span>
            </div>
            {filteredRows.map((row) => (
              <MatchTableRow
                row={row}
                favorite={favorites.includes(row.match.id)}
                onFavorite={() => toggleFavorite(row.match.id)}
                onTeamSelect={onTeamSelect}
                key={row.match.id}
              />
            ))}
            {!filteredRows.length ? (
              <div className="scanner-table-empty">По выбранным фильтрам матчей нет.</div>
            ) : null}
          </div>
        </section>

        <aside className="scanner-insights" aria-label="Быстрые инсайты">
          <div className="scanner-section-heading compact">
            <div><p className="eyebrow">Текущий срез</p><h2>Быстрые инсайты</h2></div>
          </div>
          <HighestIndexInsight row={rows[0]} />
          <div className="insight-block">
            <h3>Подтверждаемость</h3>
            <InsightCount level="high" label="Высокая" value={confidenceCounts.high} />
            <InsightCount level="medium" label="Средняя" value={confidenceCounts.medium} />
            <InsightCount level="low" label="Низкая" value={confidenceCounts.low} />
            <InsightCount level="unknown" label="Недостаточно данных" value={confidenceCounts.unknown} />
          </div>
          <div className="insight-block">
            <h3>Последние изменения</h3>
            <p><b>+{recentSignals}</b> новых паттернов за 15 минут</p>
            <p><b>{highIndexCount}</b> матчей сейчас имеют индекс 70+</p>
          </div>
        </aside>
      </div>

      <section className="scanner-analytics-grid">
        <PressureOverview rows={rows.slice(0, 10)} />
        <TopPatterns items={topPatterns} />
        <ConfidenceDonut counts={confidenceCounts} total={rows.filter((row) => row.mainSignal).length} />
      </section>

      <section className="scanner-quick-actions" aria-label="Быстрые действия">
        <QuickAction icon="↻" label="Обновить live" note="Обновить данные" onClick={onRefresh} disabled={refreshing} />
        <QuickAction icon="ϟ" label="Открыть сигналы" note={`${summary.activeSignalsCount} найдено`} onClick={() => onNavigate("signals")} />
        <QuickAction icon="◷" label="История матчей" note="Последние события" onClick={() => onNavigate("history")} />
        <QuickAction icon="◉" label="Паттерны" note="Мои условия" onClick={() => onNavigate("patterns")} />
        <QuickAction icon="⇩" label="Экспорт отчёта" note="Скачать JSON" onClick={exportSnapshot} />
      </section>
    </div>
  );
}

function PriorityPatternCard({ row, onTeamSelect }: { row: MatchRow; onTeamSelect: LiveScannerViewProps["onTeamSelect"] }) {
  const signal = row.mainSignal!;
  const side = signal.teamSide;
  return (
    <article className={`priority-pattern-card confidence-${row.confidence.level}`}>
      <div className="priority-match-line">
        <button type="button" onClick={() => selectTeam(row.match, "home", onTeamSelect)}>{row.match.homeTeam}</button>
        <span>—</span>
        <button type="button" onClick={() => selectTeam(row.match, "away", onTeamSelect)}>{row.match.awayTeam}</button>
      </div>
      <div className="priority-score-line"><strong>{row.match.scoreHome}:{row.match.scoreAway}</strong><span>{row.match.minute}'</span><b>{row.index}</b></div>
      <h3>{patternLabel(signal)}</h3>
      <ActivitySparkline row={row} side={side} />
      <div className="confidence-line"><i aria-hidden="true" /><span>{row.confidence.label}</span></div>
    </article>
  );
}

function MatchTableRow({ row, favorite, onFavorite, onTeamSelect }: {
  row: MatchRow;
  favorite: boolean;
  onFavorite: () => void;
  onTeamSelect: LiveScannerViewProps["onTeamSelect"];
}) {
  return (
    <div className="scanner-table-row" role="row">
      <span className="league-cell" data-label="Лига">{row.match.league}</span>
      <span className="match-cell" data-label="Матч">
        <button type="button" onClick={() => selectTeam(row.match, "home", onTeamSelect)}>{row.match.homeTeam}</button>
        <i>—</i>
        <button type="button" onClick={() => selectTeam(row.match, "away", onTeamSelect)}>{row.match.awayTeam}</button>
      </span>
      <strong data-label="Счёт">{row.match.scoreHome}:{row.match.scoreAway}</strong>
      <span data-label="Минута">{row.match.minute}'</span>
      <span data-label="Индекс"><b className={`index-pill index-${indexLevel(row.index)}`}>{row.index}</b></span>
      <span className="pattern-cell" data-label="Паттерн">{row.mainSignal ? patternLabel(row.mainSignal) : "Наблюдение"}</span>
      <span data-label="Подтверждение"><ConfidenceBadge confidence={row.confidence} /></span>
      <button className={`favorite-button ${favorite ? "is-active" : ""}`} type="button" onClick={onFavorite} aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"}>{favorite ? "★" : "☆"}</button>
    </div>
  );
}

function ScannerKpi({ icon, label, value, note }: { icon: string; label: string; value: number; note: string }) {
  return <article className="scanner-kpi-card"><i>{icon}</i><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button className={active ? "is-active" : ""} type="button" onClick={onClick}>{children}</button>;
}

function HighestIndexInsight({ row }: { row?: MatchRow }) {
  if (!row) return <div className="insight-block"><h3>Самый высокий индекс</h3><p>Нет live-матчей.</p></div>;
  return (
    <div className="insight-block highest-index-insight">
      <span>Самый высокий индекс сейчас</span>
      <strong>{row.index}</strong>
      <b>{row.match.homeTeam} — {row.match.awayTeam}</b>
      <small>Главный паттерн</small>
      <p>{row.mainSignal ? patternLabel(row.mainSignal) : "Матч под наблюдением"}</p>
      <ActivitySparkline row={row} side={row.mainSignal?.teamSide || "home"} />
    </div>
  );
}

function InsightCount({ level, label, value }: { level: ConfidenceLevel; label: string; value: number }) {
  return <div className="insight-count"><i className={`dot-${level}`} /><span>{label}</span><strong>{value}</strong></div>;
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return <span className={`confidence-badge confidence-${confidence.level}`}>{confidence.percent == null ? "Нет выборки" : `${confidence.percent}%`}</span>;
}

function ActivitySparkline({ row, side }: { row: MatchRow; side: TeamSide }) {
  const stats = row.snapshot?.[side] || {};
  const values = [
    Math.min(100, stats.possession || 0),
    Math.min(100, (stats.shotsTotal || 0) * 7),
    Math.min(100, (stats.shotsOnTarget || 0) * 14),
    Math.min(100, (stats.corners || 0) * 12),
    Math.min(100, (stats.xG ?? stats.xg ?? 0) * 35),
    row.index
  ];
  const points = values.map((value, index) => `${index * 20},${38 - value * 0.34}`).join(" ");
  return <svg className="activity-sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Профиль текущей активности"><polyline points={points} /></svg>;
}

function PressureOverview({ rows }: { rows: MatchRow[] }) {
  const values = rows.length ? rows.map((row) => row.index) : [0];
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 300 : (index / (values.length - 1)) * 580 + 10;
    return `${x},${145 - value * 1.25}`;
  }).join(" ");
  return (
    <article className="scanner-analytics-card pressure-overview">
      <p className="eyebrow">Текущий пул</p><h3>Срез индекса давления</h3>
      <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="Индекс давления по текущим матчам">
        <line x1="0" y1="35" x2="600" y2="35" /><line x1="0" y1="85" x2="600" y2="85" /><line x1="0" y1="135" x2="600" y2="135" />
        <polyline points={points} />
      </svg>
      <span>Матчи отсортированы по текущему индексу, без прогноза будущих событий.</span>
    </article>
  );
}

function TopPatterns({ items }: { items: Array<{ type: string; count: number; percent: number }> }) {
  return (
    <article className="scanner-analytics-card">
      <p className="eyebrow">Структура сигналов</p><h3>Топ паттернов</h3>
      <div className="top-pattern-list">
        {items.map((item) => <div key={item.type}><span>{patternLabel({ patternType: item.type })}</span><i><em style={{ width: `${item.percent}%` }} /></i><strong>{item.percent}%</strong></div>)}
        {!items.length ? <p className="muted">Сигналов для распределения пока нет.</p> : null}
      </div>
    </article>
  );
}

function ConfidenceDonut({ counts, total }: { counts: Record<ConfidenceLevel, number>; total: number }) {
  const high = total ? (counts.high / total) * 100 : 0;
  const medium = total ? (counts.medium / total) * 100 : 0;
  const low = total ? (counts.low / total) * 100 : 0;
  return (
    <article className="scanner-analytics-card distribution-card">
      <p className="eyebrow">Историческая выборка</p><h3>Live-распределение</h3>
      <div className="confidence-donut" style={{ "--high": `${high}%`, "--medium": `${high + medium}%`, "--low": `${high + medium + low}%` } as CSSProperties}>
        <div><strong>{total}</strong><span>матчей</span></div>
      </div>
      <div className="donut-legend"><InsightCount level="high" label="Высокая" value={counts.high} /><InsightCount level="medium" label="Средняя" value={counts.medium} /><InsightCount level="low" label="Низкая" value={counts.low} /></div>
    </article>
  );
}

function QuickAction({ icon, label, note, onClick, disabled = false }: { icon: string; label: string; note: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled}><i>{icon}</i><span><b>{label}</b><small>{note}</small></span></button>;
}

function buildRows(matches: Match[], snapshots: MatchStatsSnapshot[], signals: Signal[], history: PatternEvent[]): MatchRow[] {
  return matches.map((match) => {
    const snapshot = snapshots.find((item) => item.matchId === match.id);
    const matchSignals = signals.filter((signal) => signal.matchId === match.id).sort((a, b) => b.pressureScore - a.pressureScore);
    const mainSignal = matchSignals[0];
    const snapshotIndex = snapshot ? Math.max(calculatePressureScore(snapshot.home), calculatePressureScore(snapshot.away)) : 0;
    return {
      match,
      snapshot,
      signals: matchSignals,
      mainSignal,
      index: mainSignal?.pressureScore ?? snapshotIndex,
      confidence: getConfidence(mainSignal, history)
    };
  }).sort((a, b) => b.index - a.index || b.match.minute - a.match.minute);
}

function getConfidence(signal: Signal | undefined, history: PatternEvent[]): Confidence {
  if (!signal) return { level: "unknown", label: "Недостаточно данных", percent: null, sample: 0 };
  const closed = history.filter((event) => patternTypeOf(event) === patternTypeOf(signal) && event.closedAt);
  if (closed.length < 3) return { level: "unknown", label: "Недостаточно данных", percent: null, sample: closed.length };
  const successful = closed.filter((event) => event.result.goalWithin15 || event.result.manualOutcome === "win" || event.status === "success").length;
  const percent = Math.round((successful / closed.length) * 100);
  if (percent >= 60) return { level: "high", label: "Высокая подтверждаемость", percent, sample: closed.length };
  if (percent >= 35) return { level: "medium", label: "Средняя подтверждаемость", percent, sample: closed.length };
  return { level: "low", label: "Низкая подтверждаемость", percent, sample: closed.length };
}

function countConfidence(rows: MatchRow[]): Record<ConfidenceLevel, number> {
  const counts: Record<ConfidenceLevel, number> = { high: 0, medium: 0, low: 0, unknown: 0 };
  rows.filter((row) => row.mainSignal).forEach((row) => { counts[row.confidence.level] += 1; });
  return counts;
}

function getTopPatterns(signals: Signal[]) {
  const counts = new Map<string, number>();
  signals.forEach((signal) => {
    const type = patternTypeOf(signal);
    counts.set(type, (counts.get(type) || 0) + 1);
  });
  return [...counts.entries()].map(([type, count]) => ({
    type,
    count,
    percent: signals.length ? Math.round((count / signals.length) * 100) : 0
  })).sort((a, b) => b.count - a.count).slice(0, 4);
}

function patternTypeOf(signal: Pick<Signal, "patternType" | "patternId"> | Partial<Pick<Signal, "patternType" | "patternId">>) {
  return signal.patternType || signal.patternId || "unknown";
}

function patternLabel(signal: Pick<Signal, "patternType" | "patternId"> | Partial<Pick<Signal, "patternType" | "patternId">>) {
  const type = patternTypeOf(signal);
  if (type === "unknown") return "Наблюдается паттерн";
  return getPatternName(type) || "Наблюдается паттерн";
}

function selectTeam(match: Match, side: TeamSide, onTeamSelect: LiveScannerViewProps["onTeamSelect"]) {
  onTeamSelect({
    matchId: match.id,
    side,
    teamId: side === "home" ? match.homeTeamId : match.awayTeamId
  });
}

function indexLevel(index: number) {
  if (index >= 70) return "high";
  if (index >= 45) return "medium";
  return "low";
}

function readFavorites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(favoritesKey) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
