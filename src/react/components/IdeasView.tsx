import { useState } from "react";
import type { FeedbackItem } from "../../types/user";
import { feedbackPriorityLabel, feedbackStatusLabel, feedbackTypeLabel, getIdeasSummary } from "../domain/socialFeedback";
import { MetricCard } from "./MetricCard";

type IdeasViewProps = {
  items: FeedbackItem[];
  onVote?: (id: string) => Promise<void>;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

export function IdeasView({ items, onVote }: IdeasViewProps) {
  const summary = getIdeasSummary(items);

  return (
    <section>
      <section className="summary-grid">
        <MetricCard label="Идей" value={summary.ideaCount} />
        <MetricCard label="Отклики" value={summary.feedbackCount} />
        <MetricCard label="Высокий приоритет" value={summary.highPriority} />
        <MetricCard label="Всего голосов" value={summary.totalVotes} />
      </section>

      <div className="ideas-grid">
        {items.length ? items.map((item) => <IdeaCard item={item} onVote={onVote} key={item.id} />) : <div className="empty-state">Идей пока нет.</div>}
      </div>
    </section>
  );
}

function IdeaCard({ item, onVote }: { item: FeedbackItem; onVote?: (id: string) => Promise<void> }) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vote() {
    if (!onVote) return;
    setVoting(true);
    setError(null);
    try { await onVote(item.id); }
    catch (voteError) { setError(voteError instanceof Error ? voteError.message : "Не удалось учесть голос."); }
    finally { setVoting(false); }
  }
  return (
    <article className="idea-card panel">
      <div className="idea-card-top">
        <span className={`quality-badge ${item.status}`}>{feedbackStatusLabel[item.status]}</span>
        <span className="count-pill">{feedbackTypeLabel[item.type]}</span>
      </div>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      <div className="idea-meta">
        <span>Приоритет: {feedbackPriorityLabel[item.priority]}</span>
        <span>{item.votes} голосов</span>
        <span>{dateFormatter.format(new Date(item.createdAt))}</span>
      </div>
      {onVote ? (
        <button className="ghost-button" type="button" onClick={vote} disabled={voting}>
          {voting ? "Сохраняем..." : "Поддержать идею"}
        </button>
      ) : null}
      {error ? <p className="muted">{error}</p> : null}
    </article>
  );
}
