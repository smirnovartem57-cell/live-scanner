(function () {
  function formatResult(value) {
    const result = value?.result || value || {};
    if (result.manualOutcome === "win") return "Закрыто вручную: Win";
    if (result.manualOutcome === "lose") return "Закрыто вручную: Lose";
    if (result.goalWithin5) return "Гол до 5 мин";
    if (result.goalWithin10) return "Гол до 10 мин";
    if (result.goalWithin15) return "Гол до 15 мин";
    return "Гола нет";
  }

  function formatMatchResult(status) {
    const labels = {
      win: "Победа",
      draw: "Ничья",
      loss: "Поражение"
    };
    return labels[status] || status;
  }

  function formatImportance(reason) {
    const labels = {
      playoff: "плей-офф",
      final: "финал",
      derby: "дерби",
      top_opponent: "сильный соперник",
      must_win: "важный матч",
      relegation_race: "борьба внизу",
      title_race: "борьба за верх",
      manual: "отмечено вручную"
    };
    return labels[reason] || reason;
  }

  function formatTeamPatternLabel(label) {
    const labels = {
      strong: "strong",
      normal: "normal",
      weak: "weak",
      not_enough_data: "not enough data"
    };
    return labels[label] || label;
  }

  function profilePermissionLabel(status) {
    const labels = {
      active: "Готово",
      planned: "Дальше"
    };
    return labels[status] || status;
  }

  function feedbackStatusLabel(status) {
    const labels = {
      planned: "Запланировано",
      in_review: "На разборе",
      next: "Следующее"
    };
    return labels[status] || status;
  }

  function feedbackTypeLabel(type) {
    const labels = {
      idea: "Идея",
      feedback: "Отклик"
    };
    return labels[type] || type;
  }

  function feedbackPriorityLabel(priority) {
    const labels = {
      high: "высокий",
      medium: "средний",
      low: "низкий"
    };
    return labels[priority] || priority;
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    });
  }

  function formatDateTime(value) {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  window.LiveScannerFormatters = {
    escapeHtml,
    feedbackPriorityLabel,
    feedbackStatusLabel,
    feedbackTypeLabel,
    formatDate,
    formatDateTime,
    formatImportance,
    formatMatchResult,
    formatResult,
    formatTeamPatternLabel,
    profilePermissionLabel
  };
})();
