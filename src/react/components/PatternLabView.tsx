import { useMemo, useState } from "react";
import type { Pattern, PatternEvent, Signal } from "../../types/patterns";
import { getPatternName } from "../domain/labels";
import { getReactPatternStats, getRuleText, patternStatusLabel } from "../domain/patternAnalytics";
import { MetricCard } from "./MetricCard";

type PatternLabViewProps = {
  patterns: Pattern[];
  history: PatternEvent[];
  signals: Signal[];
};

export function PatternLabView({ patterns, history, signals }: PatternLabViewProps) {
  const [activePatternId, setActivePatternId] = useState(patterns[0]?.id || "");
  const activePattern = patterns.find((pattern) => pattern.id === activePatternId) || patterns[0];
  const rows = useMemo(
    () => patterns.map((pattern) => getReactPatternStats(pattern, history, signals)),
    [patterns, history, signals]
  );
  const activeStats = activePattern ? getReactPatternStats(activePattern, history, signals) : null;
  const activeSignals = activePattern ? signals.filter((signal) => signal.patternId === activePattern.id) : [];

  if (!activePattern || !activeStats) {
    return <div className="empty-state">Паттерны пока не загружены.</div>;
  }

  return (
    <section className="pattern-layout">
      <aside className="panel pattern-list">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Паттерны</p>
            <h2>Паттерны</h2>
          </div>
        </div>
        {patterns.map((pattern) => (
          <button
            className={`pattern-list-item ${pattern.id === activePattern.id ? "is-active" : ""}`}
            type="button"
            key={pattern.id}
            onClick={() => setActivePatternId(pattern.id)}
          >
            <span>{pattern.name}</span>
            <small>{pattern.enabled ? "Активен" : "Выключен"}</small>
          </button>
        ))}
      </aside>

      <section className="panel builder-panel">
        <div className="builder-header">
          <div>
            <p className="eyebrow">Паттерны &gt; {activePattern.name}</p>
            <h2>Конструктор паттерна</h2>
          </div>
          <span className={`quality-badge ${activeStats.status}`}>{patternStatusLabel[activeStats.status]}</span>
        </div>

        <p className="muted">{activePattern.description}</p>

        <div className="pattern-profile-note">
          <strong>Базовый профиль условий</strong>
          <span>Пороговые значения используются движком для поиска сигналов в live-матчах.</span>
        </div>

        <div className="threshold-list">
          {activePattern.rules.map((rule, index) => (
            <div className="threshold-row" key={`${rule.field}-${rule.operator}-${index}`}>
              <span>
                <b>{rule.label || rule.field}</b>
                <small>{getRuleText(rule)}</small>
              </span>
              <input value={String(rule.value)} readOnly aria-label={rule.label || rule.field} />
            </div>
          ))}
        </div>

        <div className="builder-actions">
          <button className="ghost-button" type="button" disabled>Сбросить условия</button>
          <button className="ghost-button" type="button" disabled>Сохранить профиль</button>
        </div>
      </section>

      <aside className="panel">
        <h2>Статистика паттерна</h2>
        <div className="mini-stats">
          <MetricCard label="Срабатываний" value={activeStats.totalSignals} />
          <MetricCard label="Активных" value={activeStats.activeSignals} />
          <MetricCard label="До 10 мин" value={activeStats.successWithin10} />
          <MetricCard label="До 15 мин" value={activeStats.successWithin15} />
          <MetricCard label="Средняя минута" value={activeStats.averageMinute} />
          <MetricCard label="Средний индекс" value={activeStats.averagePressureScore} />
        </div>
        <div className={`quality-note ${activeStats.status}`}>
          <strong>{patternStatusLabel[activeStats.status]}</strong>
          <span>{activeStats.reason}</span>
        </div>
        <div className="pattern-analytics-details">
          <div>
            <h3>Эффективность</h3>
            <span>До 5 минут <b>{activeStats.successWithin5}</b></span>
            <span>До 10 минут <b>{activeStats.successWithin10}</b></span>
            <span>До 15 минут <b>{activeStats.successRate15}%</b></span>
            <span>Оценка <b>{activeStats.qualityScore}/100</b></span>
          </div>
          <div>
            <h3>Активные сигналы</h3>
            {activeSignals.slice(0, 4).map((signal) => (
              <span key={signal.id}>{getPatternName(signal.patternType)} <b>{signal.pressureScore}</b></span>
            ))}
            {!activeSignals.length ? <span>Сейчас активных сигналов нет</span> : null}
          </div>
        </div>
      </aside>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Сводка</p>
            <h2>Статусы паттернов</h2>
          </div>
        </div>
        <div className="analytics-table">
          <div className="analytics-head">
            <span>Паттерн</span><span>Сигналов</span><span>Активных</span><span>До 15</span><span>Индекс</span><span>Оценка</span><span>Статус</span>
          </div>
          {rows.map((row) => (
            <div className={`analytics-row ${row.status}`} key={row.pattern.id}>
              <span><strong>{row.pattern.name}</strong><small>{row.reason}</small></span>
              <span>{row.totalSignals}</span>
              <span>{row.activeSignals}</span>
              <span>{row.successRate15}%</span>
              <span>{row.averagePressureScore}</span>
              <span><b>{row.qualityScore}/100</b></span>
              <span><b className={`quality-badge ${row.status}`}>{patternStatusLabel[row.status]}</b></span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
