import type { SignalStatus } from "../../types/patterns";

export function getPatternStatus(patternType: string): SignalStatus {
  return patternType === "empty_pressure" ? "new" : "in_progress";
}
