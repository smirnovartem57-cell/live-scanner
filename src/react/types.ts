export type ReactViewId = "scanner" | "signals" | "patterns" | "history" | "analytics" | "profile" | "ideas" | "settings";

export type ReactNavItem = {
  id: ReactViewId;
  label: string;
  title: string;
};
