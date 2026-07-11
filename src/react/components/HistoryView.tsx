import { useMemo, useState } from "react";
import type { PatternEvent } from "../../types/patterns";
import { formatDate } from "../domain/dateFormat";
import {
  buildHistoryExport,
  filterHistory,
  filterHistoryByPeriod,
  formatHistoryOutcome,
  formatHistoryResult,
  formatResultSource,
  getHistoryOutcome,
  getHistoryStats,
  historyFilterLabels,
  historyPeriodLabels,
  type HistoryExportFormat,
  type HistoryFilter,
  type HistoryPeriod
} from "../domain/historyAnalytics";
import { getPatternName } from "../domain/labels";
import { MetricCard } from "./MetricCard";

type HistoryViewProps = {
  history: PatternEvent[];
  serviceStartedAt?: string;
  source?: "mock" | "supabase";
  loading?: boolean;
  error?: string | null;
  closingEventId?: string | null;
  onManualClose?: (event: PatternEvent, outcome: "win" | "lose", comment: string) => Promise<void>;
  onReload?: () => void;
};

const filters: HistoryFilter[] = ["all", "win", "lose", "open"];
const periods: HistoryPeriod[] = ["today", "7d", "all"];

export function HistoryView({
  history,
  serviceStartedAt,
  source = "mock",
  loading = false,
  error = null,
  closingEventId = null,
  onManualClose,
  onReload
}: HistoryViewProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [period, setPeriod] = useState<HistoryPeriod>("all");
  const [comments, setComments] = useState<Record<string, string>>({});
  const periodHistory = useMemo(() => filterHistoryByPeriod(history, period), [history, period]);
  const filteredHistory = useMemo(() => filterHistory(periodHistory, filter), [periodHistory, filter]);
  const allStats = useMemo(() => getHistoryStats(periodHistory), [periodHistory]);
  const filteredStats = useMemo(() => getHistoryStats(filteredHistory), [filteredHistory]);
  const canCloseManually = source === "supabase" && Boolean(onManualClose);

  function updateComment(eventId: string, comment: string) {
    setComments((current) => ({ ...current, [eventId]: comment }));
  }

  async function closeManually(event: PatternEvent, outcome: "win" | "lose") {
    if (!onManualClose) return;
    await onManualClose(event, outcome, comments[event.id] || "");
  }

  function exportHistory(format: HistoryExportFormat) {
    const file = buildHistoryExport({
      events: filteredHistory,
      filter,
      period,
      format,
      getPatternName
    });
    downloadFile(file.filename, file.content, file.type);
  }

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
            <p className="eyebrow">Архив · {source === "supabase" ? "Supabase" : "Mock"}</p>
            <h2>История всех паттернов</h2>
            {error ? <p className="muted">{error}</p> : null}
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
          <div className="filter-chips compact stats-periods">
            {periods.map((item) => (
              <button
                className={`chip ${period === item ? "is-active" : ""}`}
                type="button"
                key={item}
                onClick={() => setPeriod(item)}
              >
                {historyPeriodLabels[item]}
              </button>
            ))}
          </div>
          <div className="toolbar-stats">
            <span>В выборке: {filteredStats.total}</span>
            <span>Win: {filteredStats.win}</span>
            <span>Lose: {filteredStats.lose}</span>
            <span>Открыто: {filteredStats.open}</span>
          </div>
          {onReload ? (
            <button className="mini-action" type="button" onClick={onReload} disabled={loading}>
              {loading ? "Загружаем..." : "Обновить журнал"}
            </button>
          ) : null}
          <div className="export-actions">
            <button className="ghost-button" type="button" onClick={() => exportHistory("json")} disabled={!filteredHistory.length}>
              JSON
            </button>
            <button className="ghost-button" type="button" onClick={() => exportHistory("csv")} disabled={!filteredHistory.length}>
              CSV
            </button>
          </div>
        </div>

        <div className="history-table react-history-table">
          <div className="table-head">
            <span>Матч</span><span>Паттерн</span><span>Команда</span><span>Минута</span><span>Счет</span><span>Индекс</span><span>Статус</span><span>Источник</span><span>Результат</span>
          </div>
          {filteredHistory.map((event) => (
            <HistoryRow
              event={event}
              key={event.id}
              canCloseManually={canCloseManually}
              comment={comments[event.id] || event.comment || ""}
              closing={closingEventId === event.id}
              onCommentChange={updateComment}
              onManualClose={closeManually}
            />
          ))}
          {!filteredHistory.length ? <div className="empty-state">Событий по этому фильтру нет.</div> : null}
        </div>

        <div className="history-card-list">
          {filteredHistory.map((event) => (
            <HistoryCard
              event={event}
              key={event.id}
              canCloseManually={canCloseManually}
              comment={comments[event.id] || event.comment || ""}
              closing={closingEventId === event.id}
              onCommentChange={updateComment}
              onManualClose={closeManually}
            />
          ))}
          {!filteredHistory.length ? <div className="empty-state">Событий по этому фильтру нет.</div> : null}
        </div>
      </section>
    </>
  );
}

type ManualCloseProps = {
  event: PatternEvent;
  canCloseManually: boolean;
  comment: string;
  closing: boolean;
  onCommentChange: (eventId: string, comment: string) => void;
  onManualClose: (event: PatternEvent, outcome: "win" | "lose") => void;
};

function HistoryRow(props: ManualCloseProps) {
  const { event } = props;
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
      <span>
        <small className={`quality-note ${outcome}`}>{formatHistoryResult(event)}</small>
        <ManualCloseControls {...props} />
      </span>
    </div>
  );
}

function HistoryCard(props: ManualCloseProps) {
  const { event } = props;

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
      <ManualCloseControls {...props} />
    </article>
  );
}

function ManualCloseControls({ event, canCloseManually, comment, closing, onCommentChange, onManualClose }: ManualCloseProps) {
  if (!canCloseManually) return null;

  return (
    <div className="manual-close">
      <textarea
        className="comment-field"
        value={comment}
        placeholder="Комментарий к событию"
        onChange={(input) => onCommentChange(event.id, input.target.value)}
      />
      <div className="event-actions">
        <button className="mini-action is-win" type="button" disabled={closing} onClick={() => onManualClose(event, "win")}>
          {closing ? "Сохраняем..." : "Win"}
        </button>
        <button className="mini-action is-lose" type="button" disabled={closing} onClick={() => onManualClose(event, "lose")}>
          {closing ? "Сохраняем..." : "Lose"}
        </button>
      </div>
    </div>
  );
}

function getEventTeamName(event: PatternEvent) {
  if (event.teamSide === "away") {
    return event.match.split(" - ")[1] || "Команда гостей";
  }

  return event.match.split(" - ")[0] || "Команда хозяев";
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
