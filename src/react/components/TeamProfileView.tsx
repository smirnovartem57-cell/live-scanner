import type { CSSProperties } from "react";
import type { TeamPatternSummary, TeamRecentMatch } from "../../types/football";
import type { TeamProfileViewModel } from "../domain/teamProfile";
import { formatDate } from "../domain/dateFormat";
import { getPatternName } from "../domain/labels";
import { formatImportance, formatMatchResult, formatTeamPatternLabel } from "../domain/teamLabels";

type TeamProfileViewProps = {
  profile: TeamProfileViewModel;
  onClose: () => void;
};

export function TeamProfileView({ profile, onClose }: TeamProfileViewProps) {
  const averages = profile.averages || {};
  const patterns = profile.characteristicPatterns || [];
  const recentMatches = profile.recentMatches || [];

  return (
    <section className="team-profile-panel">
      <div className="team-breadcrumbs">Сканер матчей / Профиль команды</div>
      <div className="team-profile-header">
        <div className="team-logo" aria-hidden="true">{profile.logo || profile.name.slice(0, 3).toUpperCase()}</div>
        <div>
          <p className="eyebrow">{profile.country || "Команда"} · {profile.league || profile.match.league}</p>
          <h2>{profile.name}</h2>
          <span>{profile.match.homeTeam} - {profile.match.awayTeam} · {profile.match.minute}' · {profile.match.scoreHome}:{profile.match.scoreAway}</span>
          <p>{profile.summary}</p>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>Закрыть</button>
      </div>

      <div className="team-kpi-grid">
        <TeamKpiCard label="Индекс давления" value={profile.pressureScore} progress={profile.pressureScore} />
        <TeamKpiCard label="Разница с соперником" value={profile.pressureGap > 0 ? `+${profile.pressureGap}` : profile.pressureGap} progress={Math.min(100, Math.abs(profile.pressureGap) * 2)} />
        <TeamKpiCard label="Сигналов в матче" value={profile.signals.length} progress={Math.min(100, profile.signals.length * 16)} />
        <TeamKpiCard label="Доля Win в истории" value={`${profile.historyStats.winRate}%`} progress={profile.historyStats.winRate} />
      </div>

      <div className="team-profile-body">
        <article>
          <h3>Текущая статистика</h3>
          <div className="team-quick-stats">
            <QuickStat label="Атаки" value={profile.stats.attacks || 0} />
            <QuickStat label="Опасные" value={profile.stats.dangerousAttacks || 0} />
            <QuickStat label="Удары" value={profile.stats.shotsTotal || 0} />
            <QuickStat label="В створ" value={profile.stats.shotsOnTarget || 0} />
            <QuickStat label="Угловые" value={profile.stats.corners || 0} />
          </div>
        </article>
        <article>
          <h3>Активные сигналы</h3>
          {profile.signals.slice(0, 4).map((signal) => (
            <span className="profile-signal" key={signal.id}>{getPatternName(signal.patternType)} · {signal.pressureScore}</span>
          ))}
          {!profile.signals.length ? <p>Сейчас активных сигналов по команде нет.</p> : null}
        </article>
        <article>
          <h3>Средние значения</h3>
          <p>Матчей в профиле: {averages.matchesCount || 0}</p>
          <p>Опасные атаки: {averages.dangerousAttacks || 0}</p>
          <p>Средний индекс: {averages.pressureScore || 0}</p>
        </article>
      </div>

      <div className="team-profile-sections">
        <TeamPatterns patterns={patterns} />
        <TeamRecentMatches matches={recentMatches} />
        <TeamAverages profile={profile} />
        <TeamImportantMatches profile={profile} />
      </div>
    </section>
  );
}

function TeamKpiCard({ label, value, progress }: { label: string; value: string | number; progress: number }) {
  return (
    <article className="team-kpi-card">
      <div className="mini-radial" style={{ "--score": Math.max(0, Math.min(100, Number(progress) || 0)) } as CSSProperties & { "--score": number }}>
        <b>{value}</b>
      </div>
      <span>{label}</span>
      <i><em style={{ width: `${Math.max(0, Math.min(100, Number(progress) || 0))}%` }} /></i>
    </article>
  );
}

function QuickStat({ label, value }: { label: string; value: string | number }) {
  return <span><b>{value}</b>{label}</span>;
}

function TeamPatterns({ patterns }: { patterns: TeamPatternSummary[] }) {
  return (
    <article className="team-section">
      <h3>Характерные паттерны</h3>
      <div className="team-mini-table pattern-table">
        <div><b>Паттерн</b><b>Сигналов</b><b>До 10</b><b>До 15</b><b>Минута</b><b>Индекс</b><b>Оценка</b></div>
        {patterns.map((pattern) => (
          <div key={`${pattern.teamId}-${pattern.patternId}`}>
            <span>{pattern.patternName}</span>
            <span>{pattern.totalSignals}</span>
            <span>{pattern.successRate10}%</span>
            <span>{pattern.successRate15}%</span>
            <span>{pattern.averageMinute}'</span>
            <span>{pattern.averagePressureScore}</span>
            <span><b className={`team-pattern-label ${pattern.label}`}>{formatTeamPatternLabel(pattern.label)}</b></span>
          </div>
        ))}
        {!patterns.length ? <div><span>Недостаточно данных</span></div> : null}
      </div>
    </article>
  );
}

function TeamRecentMatches({ matches }: { matches: TeamRecentMatch[] }) {
  return (
    <article className="team-section">
      <h3>Последние матчи</h3>
      <div className="team-mini-table recent-table">
        <div><b>Дата</b><b>Соперник</b><b>Счет</b><b>Турнир</b><b>Статус</b><b>Важность</b></div>
        {matches.map((match) => (
          <div key={`${match.date}-${match.opponent}`}>
            <span>{formatDate(match.date)}</span>
            <span>{match.opponent}</span>
            <span>{match.score}</span>
            <span>{match.tournament}</span>
            <span>{formatMatchResult(match.status)}</span>
            <span>{formatImportance(match.importanceReason)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function TeamAverages({ profile }: { profile: TeamProfileViewModel }) {
  const first = profile.firstHalfAverages || {};
  const second = profile.secondHalfAverages || {};
  const firstPressure = (first as { pressureScore?: number }).pressureScore || 0;
  const secondPressure = (second as { pressureScore?: number }).pressureScore || 0;

  return (
    <article className="team-section">
      <h3>Средние по таймам</h3>
      <div className="team-mini-table period-table">
        <div><b>Период</b><b>Опасные</b><b>Удары</b><b>В створ</b><b>Угловые</b><b>Индекс</b></div>
        <div><span>1 тайм</span><span>{first.dangerousAttacks || 0}</span><span>{first.shotsTotal || 0}</span><span>{first.shotsOnTarget || 0}</span><span>{first.corners || 0}</span><span>{firstPressure}</span></div>
        <div><span>2 тайм</span><span>{second.dangerousAttacks || 0}</span><span>{second.shotsTotal || 0}</span><span>{second.shotsOnTarget || 0}</span><span>{second.corners || 0}</span><span>{secondPressure}</span></div>
      </div>
    </article>
  );
}

function TeamImportantMatches({ profile }: { profile: TeamProfileViewModel }) {
  const matches = profile.importantMatches || [];

  return (
    <article className="team-section wide">
      <h3>Важные матчи</h3>
      <div className="important-list">
        {matches.map((match, index) => {
          const item = match as { date?: string; opponent?: string; score?: string; tournament?: string; importanceReason?: string; triggeredPatterns?: string[] };
          return (
            <div key={`${item.date}-${item.opponent}-${index}`}>
              <strong>{formatDate(item.date)} · {item.opponent || "Соперник"} · {item.score || "-"}</strong>
              <span>{item.tournament || profile.league} · {formatImportance(item.importanceReason)}</span>
              <small>{(item.triggeredPatterns || []).join(", ") || "Паттерны не указаны"}</small>
            </div>
          );
        })}
        {!matches.length ? <p className="muted">Важных матчей пока нет.</p> : null}
      </div>
    </article>
  );
}
