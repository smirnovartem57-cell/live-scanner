import { useMemo, useState } from "react";
import type { Match, MatchEvent, MatchStatsSnapshot } from "../../types/football";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import { getDataQualityStats } from "../domain/dataQuality";
import { getHistoryStats } from "../domain/historyAnalytics";
import { getReactPatternStats, getWeakPatternRows, patternStatusLabel, sortPatternRows } from "../domain/patternAnalytics";
import { MetricCard } from "./MetricCard";

type AnalyticsSort = "quality" | "weak" | "sample" | "pressure";

type AnalyticsViewProps = {
  matches: Match[];
  snapshots: MatchStatsSnapshot[];
  events: Record<string, MatchEvent[]>;
  patterns: Pattern[];
  history: PatternEvent[];
  signals: Signal[];
};

const sortLabels: Record<AnalyticsSort, string> = {
  quality: "По оценке",
  weak: "Слабые",
  sample: "Выборка",
  pressure: "Индекс"
};

export function AnalyticsView({ matches, snapshots, events, patterns, history, signals }: AnalyticsViewProps) {
  const [sortMode, setSortMode] = useState<AnalyticsSort>("quality");
  const journalStats = useMemo(() => getHistoryStats(history), [history]);
  const dataQuality = useMemo(() => getDataQualityStats(matches, snapshots, events), [matches, snapshots, events]);
  const patternRows = useMemo(
    () => sortPatternRows(patterns.map((pattern) => getReactPatternStats(pattern, history, signals)), sortMode),
    [patterns, history, signals, sortMode]
  );
  const weakRows = useMemo(() => getWeakPatternRows(patternRows), [patternRows]);

  return (
    <>
      <section className="summary-grid journal-summary">
        <MetricCard label="Событий всего" value={journalStats.total} />
        <MetricCard label="Win" value={journalStats.win} />
        <MetricCard label="Lose" value={journalStats.lose} />
        <MetricCard label="В процессе" value={journalStats.open} />
        <MetricCard label="Доля Win" value={`${journalStats.winRate}%`} />
        <MetricCard label="Качество данных" value={`${dataQuality.healthScore}/100`} />
      </section>

      <section className="section-grid">
        <div className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Аналитика</p>
              <h2>Pattern Analytics</h2>
            </div>
          </div>
          <div className="filter-chips compact analytics-sort">
            {(Object.keys(sortLabels) as AnalyticsSort[]).map((item) => (
              <button className={`chip ${sortMode === item ? "is-active" : ""}`} type="button" key={item} onClick={() => setSortMode(item)}>
                {sortLabels[item]}
              </button>
            ))}
          </div>
          <div className="analytics-table react-analytics-table">
            <div className="analytics-head">
              <span>Паттерн</span><span>Сигналов</span><span>До 5</span><span>До 10</span><span>До 15</span><span>Не подтверждено</span><span>Индекс</span><span>Минута</span><span>Оценка</span><span>Статус</span>
            </div>
            {patternRows.map((row) => (
              <div className={`analytics-row ${row.status}`} key={row.pattern.id}>
                <span><strong>{row.pattern.name}</strong><small>{row.reason}</small></span>
                <span>{row.totalSignals}</span>
                <span>{row.successWithin5}</span>
                <span>{row.successWithin10}</span>
                <span>{row.successWithin15}</span>
                <span>{row.failedSignals}</span>
                <span>{row.averagePressureScore}</span>
                <span>{row.averageMinute}'</span>
                <span><b>{row.qualityScore}/100</b></span>
                <span><b className={`quality-badge ${row.status}`}>{patternStatusLabel[row.status]}</b></span>
              </div>
            ))}
          </div>
        </div>

        <aside className="panel">
          <h2>Требуют внимания</h2>
          <div className="watchlist">
            {weakRows.length ? weakRows.map((row) => (
              <span key={row.pattern.id}>
                <b>{row.pattern.name}</b>
                <small>{row.reason} Оценка {row.qualityScore}/100.</small>
              </span>
            )) : (
              <span><b>Явных слабых мест нет</b><small>Продолжаем собирать выборку.</small></span>
            )}
          </div>
        </aside>
      </section>

      <section className="panel data-quality-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Источник данных</p>
            <h2>Монитор качества данных</h2>
          </div>
          <span className={`quality-badge ${dataQuality.status}`}>{dataQuality.label}</span>
        </div>
        <div className="data-quality-grid">
          <DataQualityMetric label="Матчи" value={dataQuality.matches} />
          <DataQualityMetric label="Статистика" value={`${dataQuality.statsCoverage}%`} />
          <DataQualityMetric label="События" value={`${dataQuality.eventsCoverage}%`} />
          <DataQualityMetric label="Свежесть" value={dataQuality.freshnessLabel} />
        </div>
        <div className="source-health-list">
          <span><b>MockFootballProvider</b> режим источника</span>
          <span><b>{dataQuality.snapshots}</b> снимков статистики</span>
          <span><b>{dataQuality.eventMatches}</b> матчей с событиями</span>
          <span><b>{dataQuality.lastUpdatedLabel}</b> последнее обновление</span>
        </div>
        <p className="muted">{dataQuality.summary}</p>
      </section>
    </>
  );
}

function DataQualityMetric({ label, value }: { label: string; value: string | number }) {
  return <span className="data-quality-metric"><b>{value}</b>{label}</span>;
}
