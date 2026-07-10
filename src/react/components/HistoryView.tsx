import { useMemo, useState } from "react";
import type { PatternEvent } from "../../types/patterns";
import { formatDate } from "../domain/dateFormat";
import {
  filterHistory,
  formatHistoryOutcome,
  formatHistoryResult,
  formatResultSource,
  getHistoryOutcome,
  getHistoryStats,
  historyFilterLabels,
  type HistoryFilter
} from "../domain/historyAnalytics";
import { getPatternName } from "../domain/labels";
import { MetricCard } from "./MetricCard";

type HistoryViewProps = {
  history: PatternEvent[];
  serviceStartedAt?: string;
};

const filters: HistoryFilter[] = ["all", "win", "lose", "open"];

export function HistoryView({ history, serviceStartedAt }: HistoryViewProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const filteredHistory = useMemo(() => filterHistory(history, filter), [history, filter]);
  const allStats = useMemo(() => getHistoryStats(history), [history]);
  const filteredStats = useMemo(() => getHistoryStats(filteredHistory), [filteredHistory]);

  return (
    <>
      <section className="summary-grid journal-summary">
        <MetricCard label="Сервис запущен" value={formatDate(serviceStartedAt || history[0]?.createdAt)} />
        <MetricCard label="Всего событий" value={allStats.total} />
        <MetricCard label="Win" value={allStats.win} />
        <MetricCard label="Lose" value={allStats.lose} />
        <MetricCard label="В процессе" value={allStats.open} />
        <MetricCard label="Доля Win" value={`${allStats.winRate}%`} />
      </section>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Архив</p>
            <h2>История всех паттернов</h2>
          </div>
          <span className="count-pill">{filteredHistory.length}</span>
        </div>

        <div className="history-toolbar">
          <div className="filter-chips compact">
            {filters.map((item) => (
              <button
                className={`chip ${filter === item ? "is-active" : ""}`}
                type="button"
                key={item}
                onClick={() => setFilter(item)}
              >
                {historyFilterLabels[item]}
              </button>
            ))}
          </div>
          <div className="toolbar-stats">
            <span>В выборке: {filteredStats.total}</span>
            <span>Win: {filteredStats.win}</span>
            <span>Lose: {filteredStats.lose}</span>
            <span>Открыто: {filteredStats.open}</span>
          </div>
        </div>

        <div className="history-table react-history-table">
          <div className="table-head">
            <span>Матч</span><span>Паттерн</span><span>Команда</span><span>Минута</span><span>Счет</span><span>Индекс</span><span>Статус</span><span>Источник</span><span>Результат</span>
          </div>
          {filteredHistory.map((event) => (
            <HistoryRow event={event} key={event.id} />
          ))}
          {!filteredHistory.length ? <div className="empty-state">Событий по этому фильтру нет.</div> : null}
        </div>

        <div className="history-card-list">
          {filteredHistory.map((event) => (
            <HistoryCard event={event} key={event.id} />
          ))}
          {!filteredHistory.length ? <div className="empty-state">Событий по этому фильтру нет.</div> : null}
        </div>
      </section>
    </>
  );
}

function HistoryRow({ event }: { event: PatternEvent }) {
  const outcome = getHistoryOutcome(event);

  return (
    <div className={`table-row ${event.signalKind === "warning" ? "is-warning" : ""}`}>
      <span><strong>{event.match}</strong><small>{event.league}</small></span>
      <span>{getPatternName(event.patternType)}</span>
      <span>{getEventTeamName(event)}</span>
      <span>{event.minute}'</span>
      <span>{event.score}</span>
      <span>{event.pressureScore || "-"}</span>
      <span><b className={`status-dot ${event.status}`} />{formatHistoryOutcome(event)}</span>
      <span><b className={`source-pill ${event.resultSource}`}>{formatResultSource(event)}</b></span>
      <span><small className={`quality-note ${outcome}`}>{formatHistoryResult(event)}</small></span>
    </div>
  );
}

function HistoryCard({ event }: { event: PatternEvent }) {
  return (
    <article className={`history-card ${event.signalKind === "warning" ? "is-warning" : ""}`}>
      <div className="history-card-head">
        <div>
          <strong>{event.match}</strong>
          <span>{event.league} · {getEventTeamName(event)}</span>
        </div>
        <b className={`source-pill ${event.resultSource}`}>{formatResultSource(event)}</b>
      </div>
      <div className="history-card-pattern">
        <span>{getPatternName(event.patternType)}</span>
      </div>
      <div className="history-card-metrics">
        <span><b>{event.minute}'</b>Минута</span>
        <span><b>{event.score}</b>Счет</span>
        <span><b>{event.pressureScore || "-"}</b>Индекс</span>
      </div>
      <div className="history-card-status">
        <span><b className={`status-dot ${event.status}`} />{formatHistoryOutcome(event)}</span>
        <small>{formatHistoryResult(event)}</small>
      </div>
    </article>
  );
}

function getEventTeamName(event: PatternEvent) {
  if (event.teamSide === "away") {
    return event.match.split(" - ")[1] || "Команда гостей";
  }

  return event.match.split(" - ")[0] || "Команда хозяев";
}
