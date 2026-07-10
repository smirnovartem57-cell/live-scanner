(function () {
  function getFilteredHistory(events, filter) {
    return events.filter((event) => {
      if (filter === "win") return getOutcome(event) === "win";
      if (filter === "lose") return getOutcome(event) === "lose";
      if (filter === "open") return getOutcome(event) === "open";
      return true;
    });
  }

  function getHistoryByPeriod(events, period, nowValue = new Date()) {
    if (period === "all") return events;

    const start = new Date(nowValue);
    if (period === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (period === "7d") {
      start.setDate(start.getDate() - 7);
    }

    return events.filter((event) => new Date(event.createdAt).getTime() >= start.getTime());
  }

  function getJournalStats(events, startedAt) {
    const total = events.length;
    const win = events.filter((event) => getOutcome(event) === "win").length;
    const lose = events.filter((event) => getOutcome(event) === "lose").length;
    const open = events.filter((event) => getOutcome(event) === "open").length;
    const closed = win + lose;

    return {
      startedAt,
      total,
      win,
      lose,
      open,
      winRate: closed ? Math.round((win / closed) * 100) : 0
    };
  }

  function getOutcome(event) {
    if (event.status === "success") return "win";
    if (event.status === "failed") return "lose";
    return "open";
  }

  function formatOutcome(event) {
    const outcome = getOutcome(event);
    if (outcome === "win") return "Win";
    if (outcome === "lose") return "Lose";
    return "В процессе";
  }

  function formatResultSource(event) {
    if (event.resultSource === "manual" || event.result?.manualOutcome) return "Вручную";
    if (event.resultSource === "auto") return "Авто";
    return "Старт";
  }

  function buildHistoryExport({ events, filter, format, patternLabels }) {
    const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
    return {
      filename: `football-pattern-history-${filter}-${timestamp}.${format}`,
      content: format === "csv" ? historyToCsv(events, patternLabels) : JSON.stringify(events, null, 2),
      type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8"
    };
  }

  function historyToCsv(events, patternLabels = {}) {
    const headers = ["id", "matchId", "teamId", "match", "league", "minute", "pattern", "signalKind", "resultSource", "scoreHome", "scoreAway", "pressureScore", "strength", "outcome", "status", "goalWithin5", "goalWithin10", "goalWithin15", "goalMinute", "goalTeam", "finalComment", "createdAt", "updatedAt", "closedAt"];
    const rows = events.map((event) => [
      event.id,
      event.matchId,
      event.teamId,
      event.match,
      event.league,
      event.minute,
      patternLabels[event.patternType] || event.patternType,
      event.signalKind || "",
      formatResultSource(event),
      event.scoreHome,
      event.scoreAway,
      event.pressureScore,
      event.strength,
      getOutcome(event),
      event.status,
      event.result.goalWithin5,
      event.result.goalWithin10,
      event.result.goalWithin15,
      event.result.goalMinute || "",
      event.result.goalTeam || "",
      event.result.finalComment || event.comment || "",
      event.createdAt,
      event.updatedAt || "",
      event.closedAt || ""
    ]);

    return `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`;
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  window.LiveScannerHistoryService = {
    buildHistoryExport,
    formatOutcome,
    formatResultSource,
    getFilteredHistory,
    getHistoryByPeriod,
    getJournalStats,
    getOutcome,
    historyToCsv
  };
})();
