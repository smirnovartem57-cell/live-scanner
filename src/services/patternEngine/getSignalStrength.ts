export type SignalStrength = "LOW" | "MED" | "HIGH";

export function getSignalStrength(pressureScore: number): SignalStrength {
  if (pressureScore >= 75) return "HIGH";
  if (pressureScore >= 50) return "MED";
  return "LOW";
}
