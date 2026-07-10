export type ReactViewId = "scanner" | "signals" | "patterns" | "history" | "analytics";

export type ReactNavItem = {
  id: ReactViewId;
  label: string;
  title: string;
};
