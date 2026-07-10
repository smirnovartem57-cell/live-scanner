export type ReactViewId = "scanner" | "signals" | "patterns" | "history" | "analytics" | "settings";

export type ReactNavItem = {
  id: ReactViewId;
  label: string;
  title: string;
};
