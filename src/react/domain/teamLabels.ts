export function formatMatchResult(status: string) {
  const labels: Record<string, string> = {
    win: "Победа",
    draw: "Ничья",
    loss: "Поражение"
  };
  return labels[status] || status;
}

export function formatTeamPatternLabel(label: string) {
  const labels: Record<string, string> = {
    strong: "strong",
    normal: "normal",
    weak: "weak",
    not_enough_data: "not enough data"
  };
  return labels[label] || label;
}

export function formatImportance(reason?: string) {
  const labels: Record<string, string> = {
    playoff: "плей-офф",
    final: "финал",
    derby: "дерби",
    top_opponent: "сильный соперник",
    must_win: "важный матч",
    relegation_race: "борьба внизу",
    title_race: "борьба за верх",
    manual: "отмечено вручную"
  };

  return reason ? labels[reason] || reason : "обычный матч";
}
