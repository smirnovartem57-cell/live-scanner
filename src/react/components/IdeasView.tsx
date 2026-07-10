import type { FeedbackItem } from "../../types/user";
import { feedbackPriorityLabel, feedbackStatusLabel, feedbackTypeLabel, getIdeasSummary } from "../domain/socialFeedback";
import { MetricCard } from "./MetricCard";

type IdeasViewProps = {
  items: FeedbackItem[];
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

export function IdeasView({ items }: IdeasViewProps) {
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
        {items.length ? items.map((item) => <IdeaCard item={item} key={item.id} />) : <div className="empty-state">Идей пока нет.</div>}
      </div>
    </section>
  );
}

function IdeaCard({ item }: { item: FeedbackItem }) {
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
    </article>
  );
}
