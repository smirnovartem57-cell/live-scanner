export type SignalStatus = "new" | "in_progress" | "success" | "failed";

export function getPatternStatus(patternType: string): SignalStatus {
  return patternType === "empty_pressure" ? "new" : "in_progress";
}
