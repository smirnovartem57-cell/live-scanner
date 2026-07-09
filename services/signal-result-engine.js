function evaluateSignalResult(signal, match, events = []) {
  const result = {
    goalWithin5: false,
    goalWithin10: false,
    goalWithin15: false,
    goalMinute: null,
    goalTeam: null,
    finalComment: signal.result?.finalComment || ""
  };

  if (!match) {
    return { status: signal.status || "in_progress", result };
  }

  const goalsAfterSignal = events
    .filter((event) => event.type === "goal")
    .filter((event) => event.minute > signal.minute)
    .filter((event) => event.minute <= Math.min(match.minute, signal.minute + 15))
    .sort((a, b) => a.minute - b.minute);

  const firstGoal = goalsAfterSignal[0];
  if (firstGoal) {
    const delta = firstGoal.minute - signal.minute;
    result.goalWithin5 = delta <= 5;
    result.goalWithin10 = delta <= 10;
    result.goalWithin15 = delta <= 15;
    result.goalMinute = firstGoal.minute;
    result.goalTeam = firstGoal.teamSide;
  }

  const windowClosed = match.minute >= signal.minute + 15;
  const isWarning = signal.signalKind === "warning" || signal.patternType === "empty_pressure";
  let status = signal.status || "in_progress";

  if (signal.result?.manualOutcome) {
    return { status, result: { ...result, ...signal.result } };
  }

  if (isWarning) {
    if (result.goalWithin15) {
      status = "failed";
      result.finalComment = result.finalComment || "Предупреждение не подтвердилось: в течение 15 минут был гол.";
    } else if (windowClosed) {
      status = "success";
      result.finalComment = result.finalComment || "Предупреждение подтвердилось: за 15 минут гола не было.";
    } else {
      status = "new";
    }
  } else if (result.goalWithin15) {
    status = "success";
    result.finalComment = result.finalComment || "Сигнал подтвердился событием в окне до 15 минут.";
  } else if (windowClosed) {
    status = "failed";
    result.finalComment = result.finalComment || "Окно 15 минут закрылось без подтверждения.";
  } else {
    status = "in_progress";
  }

  return { status, result };
}

window.FootballSignalResultEngine = {
  evaluateSignalResult
};
