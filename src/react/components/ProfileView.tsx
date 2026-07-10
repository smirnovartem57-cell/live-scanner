import type { PatternEvent } from "../../types/patterns";
import type { UserProfile } from "../../types/user";
import { getHistoryStats } from "../domain/historyAnalytics";
import { getProfileViewModel, profilePermissionLabel } from "../domain/socialFeedback";
import { MetricCard } from "./MetricCard";

type ProfileViewProps = {
  profile: UserProfile | null;
  history: PatternEvent[];
};

export function ProfileView({ profile, history }: ProfileViewProps) {
  const journalStats = getHistoryStats(history);
  const viewModel = getProfileViewModel(profile, journalStats);

  if (!viewModel) {
    return <div className="empty-state">Профиль пока не подготовлен.</div>;
  }

  return (
    <section className="profile-layout">
      <div className="profile-hero panel">
        <div className="profile-avatar" aria-hidden="true">{viewModel.avatar}</div>
        <div>
          <p className="eyebrow">Закрытый MVP-профиль</p>
          <h2>{viewModel.displayName}</h2>
          <span>@{viewModel.handle} · {viewModel.role}</span>
          <p>{viewModel.bio}</p>
        </div>
      </div>

      <section className="summary-grid">
        <MetricCard label="Событий в журнале" value={viewModel.summary.totalEvents} />
        <MetricCard label="Win" value={viewModel.summary.win} />
        <MetricCard label="Lose" value={viewModel.summary.lose} />
        <MetricCard label="Уровень доверия" value={viewModel.summary.trustScore} />
      </section>

      <section className="section-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Профиль</p>
              <h2>Социальное доверие</h2>
              <p>{viewModel.socialTrust.level || "Профиль в подготовке"}</p>
            </div>
            <span className="count-pill">{viewModel.socialTrust.score || 0}/100</span>
          </div>
          <div className="trust-meter"><span style={{ width: viewModel.trustMeterWidth }} /></div>
          <div className="readiness-list">
            <span><b>{viewModel.socialTrust.verifiedSignals || 0}</b> проверенных сигналов</span>
            <span><b>{viewModel.socialTrust.reviewedIdeas || 0}</b> разобранных идей</span>
            <span><b>{viewModel.socialTrust.sharedReports || 0}</b> публичных отчетов</span>
          </div>
          <div className="note-list">
            {viewModel.trustNotes.map((note) => <span key={note}>{note}</span>)}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Доступ</p>
              <h2>Права и будущие модули</h2>
            </div>
          </div>
          <div className="readiness-list">
            {viewModel.permissions.map((item) => (
              <span key={item.key}><b>{profilePermissionLabel[item.status]}</b>{item.label}</span>
            ))}
          </div>
          <div className="quality-note sample">
            <strong>Архитектурная заготовка</strong>
            <span>{viewModel.futureFields.join(" · ")}</span>
          </div>
        </div>
      </section>
    </section>
  );
}
