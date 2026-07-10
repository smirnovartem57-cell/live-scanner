import type { SignalStatus } from "../../types/patterns";

export const patternNameByType: Record<string, string> = {
  pressure_without_goal: "Давят без гола",
  late_goal: "Поздний гол",
  favorite_losing_but_pressing: "Проигрывает, но давит",
  match_woke_up: "Матч ожил",
  corner_pressure: "Давление на угловой",
  empty_pressure: "Пустое давление"
};

export const signalStatusLabel: Record<SignalStatus, string> = {
  new: "Новый",
  in_progress: "В процессе",
  success: "Win",
  failed: "Lose"
};

export function getPatternName(patternType: string) {
  return patternNameByType[patternType] || patternType;
}
