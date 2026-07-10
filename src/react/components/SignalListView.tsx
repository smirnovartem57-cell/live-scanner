import type { Match } from "../../types/football";
import type { Signal } from "../../types/patterns";
import { getPatternName, signalStatusLabel } from "../domain/labels";
import { MetricCard } from "./MetricCard";

type SignalListViewProps = {
  matches: Match[];
  signals: Signal[];
};

export function SignalListView({ matches, signals }: SignalListViewProps) {
  const sortedSignals = [...signals].sort((a, b) => b.pressureScore - a.pressureScore);
  const warningCount = sortedSignals.filter((signal) => signal.signalKind === "warning").length;
  const highCount = sortedSignals.filter((signal) => signal.strength === "HIGH").length;

  return (
    <>
      <section className="summary-grid">
        <MetricCard label="Всего сигналов" value={sortedSignals.length} />
        <MetricCard label="Высокий индекс" value={highCount} />
        <MetricCard label="Предупреждений" value={warningCount} />
        <MetricCard label="Матчей в работе" value={new Set(sortedSignals.map((signal) => signal.matchId)).size} />
      </section>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Активные</p>
            <h2>Найденные сигналы</h2>
          </div>
          <span className="count-pill">{sortedSignals.length}</span>
        </div>

        <div className="signal-table">
          {sortedSignals.length ? sortedSignals.map((signal) => (
            <SignalRow signal={signal} match={matches.find((item) => item.id === signal.matchId)} key={signal.id} />
          )) : <div className="empty-state">Активных сигналов пока нет.</div>}
        </div>
      </section>
    </>
  );
}

function SignalRow({ signal, match }: { signal: Signal; match?: Match }) {
  const teamName = getSignalTeamName(signal, match);
  const score = `${signal.scoreHome}:${signal.scoreAway}`;

  return (
    <article className={`signal-row-card ${signal.signalKind === "warning" ? "is-warning" : ""}`}>
      <div>
        <strong>{getPatternName(signal.patternType)}</strong>
        <span>{match ? `${match.homeTeam} - ${match.awayTeam} · ${match.league}` : signal.matchId}</span>
        <small>{teamName}: {signal.explanation}</small>
      </div>
      <span>{signal.minute}'</span>
      <span>{score}</span>
      <span className={`pressure-badge ${signal.strength.toLowerCase()}`}>{signal.pressureScore}</span>
      <span className="status-dot-wrap">
        <b className={`status-dot ${signal.status}`} />
        {signalStatusLabel[signal.status]}
      </span>
    </article>
  );
}

function getSignalTeamName(signal: Signal, match?: Match) {
  if (!match) return signal.teamSide === "home" ? "Команда хозяев" : "Команда гостей";
  return signal.teamSide === "home" ? match.homeTeam : match.awayTeam;
}
