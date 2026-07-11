import type { CSSProperties } from "react";
import type { Match, TeamSide } from "../../types/football";
import type { Signal } from "../../types/patterns";
import type { TeamProfileSelection } from "../domain/teamProfile";
import { getPatternName } from "../domain/labels";
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
  onTeamSelect: (selection: TeamProfileSelection) => void;
};

type PressureStyle = CSSProperties & {
  "--score": number;
};

export function LiveScannerView({ matches, signals, summary, onTeamSelect }: LiveScannerViewProps) {
  return (
    <>
      <section className="hero-strip">
        <div>
          <p className="eyebrow">Live-аналитика</p>
          <h2>Сканер матчей</h2>
          <span>Отслеживаем давление, темп и игровые паттерны на основе live-статистики.</span>
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
                  <TeamButton match={match} side="home" onTeamSelect={onTeamSelect} />
                  <strong>{match.scoreHome}:{match.scoreAway}</strong>
                  <TeamButton match={match} side="away" onTeamSelect={onTeamSelect} />
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
                    <p>{getPatternName(mainSignal.patternType)}</p>
                    <span>{mainSignal.explanation}</span>
                    {matchSignals.length > 1 ? (
                      <div className="pattern-badges">
                        {matchSignals.map((signal) => (
                          <span className={signal.signalKind === "warning" ? "is-warning" : ""} key={signal.id}>
                            {getPatternName(signal.patternType)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className="signal-caption">Без сигнала</span>
                    <p>Паттерны не сработали</p>
                    <span>Матч остаётся в наблюдении до следующего обновления статистики.</span>
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

function TeamButton({ match, side, onTeamSelect }: { match: Match; side: TeamSide; onTeamSelect: (selection: TeamProfileSelection) => void }) {
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;

  return (
    <button className="team-link" type="button" onClick={() => onTeamSelect({ matchId: match.id, side, teamId })}>
      {teamName}
    </button>
  );
}
