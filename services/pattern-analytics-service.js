(function () {
  function getPatternStats(pattern, events, matches = []) {
    const history = events.filter((item) => item.patternId === pattern.id);
    const totalSignals = history.length;
    const successWithin5 = history.filter((item) => item.result.goalWithin5).length;
    const successWithin10 = history.filter((item) => item.result.goalWithin10).length;
    const successWithin15 = history.filter((item) => item.result.goalWithin15).length;
    const failedSignals = history.filter((item) => window.LiveScannerHistoryService.getOutcome(item) === "lose").length;
    const pendingSignals = history.filter((item) => window.LiveScannerHistoryService.getOutcome(item) === "open").length;
    const successRate5 = getRate(successWithin5, totalSignals);
    const successRate10 = getRate(successWithin10, totalSignals);
    const successRate15 = getRate(successWithin15, totalSignals);
    const averageSignalMinute = getAverage(history.map((item) => item.minute));
    const averagePressureScore = getAverage(history.map((item) => item.pressureScore).filter(Boolean));
    const status = getPatternAnalyticsStatus({ pattern, totalSignals, successRate15 });
    const qualityScore = getPatternQualityScore({
      totalSignals,
      successRate15,
      failedSignals,
      pendingSignals,
      averagePressureScore
    });

    return {
      pattern,
      history,
      totalSignals,
      successWithin5,
      successWithin10,
      successWithin15,
      failedSignals,
      pendingSignals,
      successRate5,
      successRate10,
      successRate15,
      averageSignalMinute,
      averagePressureScore,
      bestLeagues: getGroupedPatternStats(history, "league", "best"),
      weakLeagues: getGroupedPatternStats(history, "league", "weak"),
      bestTeams: getTeamPatternGroups(history, matches, "best"),
      weakTeams: getTeamPatternGroups(history, matches, "weak"),
      status,
      qualityScore,
      updatedAt: new Date().toISOString()
    };
  }

  function sortPatternRows(rows, sortMode) {
    const sorted = [...rows];
    const sorters = {
      quality: (a, b) => b.qualityScore - a.qualityScore || b.successRate15 - a.successRate15,
      weak: (a, b) => a.qualityScore - b.qualityScore || b.failedSignals - a.failedSignals,
      sample: (a, b) => b.totalSignals - a.totalSignals,
      pressure: (a, b) => b.averagePressureScore - a.averagePressureScore
    };
    return sorted.sort(sorters[sortMode] || sorters.quality);
  }

  function getWeakPatternRows(rows) {
    return rows
      .filter((row) => ["weak", "ineffective", "testing"].includes(row.status) || row.qualityScore < 45)
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 4);
  }

  function getPatternQualityScore(stats) {
    const sampleScore = Math.min(100, stats.totalSignals * 3);
    const confirmationScore = stats.successRate15;
    const pressureScore = Math.min(100, stats.averagePressureScore || 0);
    const failedPenalty = stats.totalSignals ? Math.round((stats.failedSignals / stats.totalSignals) * 35) : 0;
    const pendingPenalty = stats.totalSignals ? Math.round((stats.pendingSignals / stats.totalSignals) * 12) : 0;
    const score = Math.round((confirmationScore * 0.5) + (sampleScore * 0.25) + (pressureScore * 0.25) - failedPenalty - pendingPenalty);
    return Math.max(0, Math.min(100, score));
  }

  function getPatternQualityLabel(row) {
    if (row.totalSignals < 10) return "малая выборка";
    if (row.qualityScore >= 70) return "сильный профиль";
    if (row.qualityScore >= 45) return "нужно наблюдать";
    return "слабый профиль";
  }

  function getPatternAnalyticsStatus({ pattern, totalSignals, successRate15 }) {
    if (pattern.analyticsStatus === "testing") return "testing";
    if (totalSignals < 30) return "new";
    if (totalSignals < 100 && successRate15 >= 35) return "promising";
    if (totalSignals >= 100 && successRate15 >= 35) return "working";
    if (totalSignals >= 100 && successRate15 >= 20) return "weak";
    if (totalSignals >= 100 && successRate15 < 20) return "ineffective";
    return "testing";
  }

  function getPatternStatusReason(stats) {
    if (stats.status === "new") return `Сигналов ${stats.totalSignals}. Нужна большая выборка.`;
    if (stats.status === "promising") return `До 15 минут ${stats.successRate15}%, выборка растет.`;
    if (stats.status === "working") return `До 15 минут ${stats.successRate15}%, выборка ${stats.totalSignals}.`;
    if (stats.status === "weak") return `До 15 минут ${stats.successRate15}%, стоит наблюдать условия.`;
    if (stats.status === "ineffective") return `До 15 минут ${stats.successRate15}%, паттерн требует пересмотра.`;
    return "Паттерн изменен или находится в ручной проверке.";
  }

  function getRate(value, total) {
    return total ? Math.round((value / total) * 100) : 0;
  }

  function getAverage(values) {
    const clean = values.filter((value) => Number.isFinite(value));
    return clean.length ? Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length) : 0;
  }

  function getGroupedPatternStats(events, key, mode) {
    const groups = new Map();
    events.forEach((event) => {
      const name = event[key] || "Не указано";
      const group = groups.get(name) || { name, total: 0, successWithin15: 0, rate15: 0 };
      group.total += 1;
      if (event.result.goalWithin15) group.successWithin15 += 1;
      group.rate15 = getRate(group.successWithin15, group.total);
      groups.set(name, group);
    });
    const sorted = [...groups.values()].sort((a, b) => mode === "best" ? b.rate15 - a.rate15 : a.rate15 - b.rate15);
    return sorted.slice(0, 3);
  }

  function getTeamPatternGroups(events, matches, mode) {
    const groups = new Map();
    events.forEach((event) => {
      const name = getEventTeamName(event, matches);
      const group = groups.get(name) || { name, total: 0, successWithin15: 0, rate15: 0 };
      group.total += 1;
      if (event.result.goalWithin15) group.successWithin15 += 1;
      group.rate15 = getRate(group.successWithin15, group.total);
      groups.set(name, group);
    });
    const sorted = [...groups.values()].sort((a, b) => mode === "best" ? b.rate15 - a.rate15 : a.rate15 - b.rate15);
    return sorted.slice(0, 3);
  }

  function getEventTeamName(event, matches = []) {
    const match = matches.find((item) => item.id === event.matchId);
    if (match && event.teamSide === "home") return match.homeTeam;
    if (match && event.teamSide === "away") return match.awayTeam;
    return event.match?.split(" - ")[0] || "Команда";
  }

  window.LiveScannerPatternAnalytics = {
    getAverage,
    getEventTeamName,
    getPatternAnalyticsStatus,
    getPatternQualityLabel,
    getPatternQualityScore,
    getPatternStats,
    getPatternStatusReason,
    getRate,
    getWeakPatternRows,
    sortPatternRows
  };
})();
