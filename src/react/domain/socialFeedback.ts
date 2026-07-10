import type { FeedbackItem, UserPermission, UserProfile } from "../../types/user";
import type { HistoryStats } from "./historyAnalytics";

export type UserProfileViewModel = UserProfile & {
  summary: {
    totalEvents: number;
    win: number;
    lose: number;
    trustScore: number;
  };
  trustMeterWidth: string;
  trustNotes: string[];
  permissions: UserPermission[];
  futureFields: string[];
};

export function getProfileViewModel(profile: UserProfile | null, journalStats: HistoryStats): UserProfileViewModel | null {
  if (!profile) return null;
  const score = clamp(profile.socialTrust.score || 0);

  return {
    ...profile,
    summary: {
      totalEvents: journalStats.total,
      win: journalStats.win,
      lose: journalStats.lose,
      trustScore: score
    },
    trustMeterWidth: `${score}%`,
    trustNotes: profile.socialTrust.notes || [],
    permissions: profile.permissions || [],
    futureFields: profile.futureFields || []
  };
}

export function getIdeasSummary(items: FeedbackItem[]) {
  return {
    ideaCount: items.filter((item) => item.type === "idea").length,
    feedbackCount: items.filter((item) => item.type === "feedback").length,
    highPriority: items.filter((item) => item.priority === "high").length,
    totalVotes: items.reduce((sum, item) => sum + item.votes, 0)
  };
}

export const feedbackStatusLabel: Record<FeedbackItem["status"], string> = {
  planned: "В плане",
  in_review: "На разборе",
  next: "Следующее"
};

export const feedbackTypeLabel: Record<FeedbackItem["type"], string> = {
  idea: "Идея",
  feedback: "Отклик"
};

export const feedbackPriorityLabel: Record<FeedbackItem["priority"], string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий"
};

export const profilePermissionLabel: Record<UserPermission["status"], string> = {
  active: "Активно",
  planned: "В плане"
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
