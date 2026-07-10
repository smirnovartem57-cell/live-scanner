export type UserProfile = {
  id: string;
  displayName: string;
  handle: string;
  role: string;
  accessLevel: string;
  joinedAt: string;
  publicProfileReady: boolean;
  avatar: string;
  bio: string;
  socialTrust: SocialTrust;
  permissions: UserPermission[];
  futureFields: string[];
};

export type SocialTrust = {
  score: number;
  level: string;
  verifiedSignals: number;
  reviewedIdeas: number;
  sharedReports: number;
  notes: string[];
};

export type UserPermission = {
  key: string;
  label: string;
  status: "active" | "planned";
};

export type TeamNoteEntry = {
  id: string;
  note: string;
  tags: string[];
  importantMatch: boolean;
  createdAt: string;
};

export type TeamNote = {
  note: string;
  tags: string[];
  importantMatch?: boolean;
  entries?: TeamNoteEntry[];
  updatedAt: string | null;
};

export type FeedbackItem = {
  id: string;
  type: "idea" | "feedback";
  title: string;
  description: string;
  status: "planned" | "in_review" | "next";
  priority: "low" | "medium" | "high";
  votes: number;
  createdAt: string;
};
