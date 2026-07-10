import type { CSSProperties } from "react";
import type { Match } from "../../types/football";
import type { Signal } from "../../types/patterns";
import { MetricCard } from "./MetricCard";

type LiveScannerViewProps = {
  matches: Match[];
  signals: Signal[];
  summary: {
    matchesCount: number;
    activeSignalsCount: number;
    highSignalsCount: number;
    patternsCount: number;
  };
};

const patternNames: Record<string, string> = {
  pressure_without_goal: "Давят без гола",
  late_goal: "Поздний гол",
  favorite_losing_but_pressing: "Проигрывает, но давит",
  match_woke_up: "Матч ожил",
  corner_pressure: "Давление на угловой",
  empty_pressure: "Пустое давление"
};

type PressureStyle = CSSProperties & {
  "--score": number;
};

export function LiveScannerView({ matches, signals, summary }: LiveScannerViewProps) {
  return (
    <>
      <section className="hero-strip">
        <div>
          <p className="eyebrow">React-версия</p>
          <h2>Сканер матчей</h2>
          <span>Первый перенос экрана на компонентную архитектуру без замены опубликованного сайта.</span>
        </div>
      </section>

      <section className="summary-grid">
        <MetricCard label="Матчей live" value={summary.matchesCount} />
        <MetricCard label="Найдено сигналов" value={summary.activeSignalsCount} />
        <MetricCard label="Высокий индекс" value={summary.highSignalsCount} />
        <MetricCard label="Активных паттернов" value={summary.patternsCount} />
      </section>

      <section className="match-feed">
        {matches.map((match) => {
          const matchSignals = signals.filter((signal) => signal.matchId === match.id);
          const mainSignal = matchSignals[0];

          return (
            <article className="match-card" key={match.id}>
              <div className="match-zone match-main-info">
                <div className="card-topline">
                  <span className="country-dot" aria-hidden="true" />
                  <span>{match.league}</span>
                  <span className="live-pill">{match.status === "halftime" ? "ПЕРЕРЫВ" : "LIVE"}</span>
                </div>
                <div className="scoreboard">
                  <b>{match.homeTeam}</b>
                  <strong>{match.scoreHome}:{match.scoreAway}</strong>
                  <b>{match.awayTeam}</b>
                </div>
                <div className="match-meta-line">
                  <span>{match.minute}'</span>
                  <span>{match.country || "Футбол"}</span>
                </div>
              </div>

              <div className="match-zone pattern-callout">
                {mainSignal ? (
                  <>
                    <span className="signal-caption">Найден паттерн</span>
                    <p>{patternNames[mainSignal.patternType] || mainSignal.patternType}</p>
                    <span>{mainSignal.explanation}</span>
                    {matchSignals.length > 1 ? (
                      <div className="pattern-badges">
                        {matchSignals.map((signal) => (
                          <span className={signal.signalKind === "warning" ? "is-warning" : ""} key={signal.id}>
                            {patternNames[signal.patternType] || signal.patternType}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className="signal-caption">Без сигнала</span>
                    <p>Паттерны не сработали</p>
                    <span>Матч остается в наблюдении до следующего обновления статистики.</span>
                  </>
                )}
              </div>

              <div className="match-zone match-index-card">
                <div className={`radial-index ${mainSignal?.strength.toLowerCase() || "low"}`} style={{ "--score": mainSignal?.pressureScore || 0 } as PressureStyle}>
                  <b>{mainSignal?.pressureScore || 0}</b>
                </div>
                <span>Индекс давления</span>
                <strong>{mainSignal?.strength || "LOW"}</strong>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
