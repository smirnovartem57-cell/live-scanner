(function () {
const SIGNAL_BUCKET_MINUTES = 10;

function calculatePressureScore(stats) {
  const xg = typeof stats.xG === "number" ? stats.xG : stats.xg;
  const xgScore = typeof xg === "number" ? xg * 15 : 0;
  const score =
    (stats.dangerousAttacks || 0) * 0.8 +
    (stats.shotsTotal || 0) * 3 +
    (stats.shotsOnTarget || 0) * 6 +
    (stats.corners || 0) * 4 +
    xgScore;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getSignalStrength(score) {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MED";
  return "LOW";
}

function getPatternStatus(patternType) {
  return patternType === "empty_pressure" ? "new" : "in_progress";
}

function evaluateMatch(match, snapshot, patterns, existingSignals = []) {
  const signals = [];

  patterns.filter((pattern) => pattern.enabled).forEach((pattern) => {
    ["home", "away"].forEach((side) => {
      const signal = evaluatePattern(match, snapshot, pattern, side);
      if (signal && !hasDuplicateSignal([...signals, ...existingSignals], signal)) {
        signals.push(signal);
      }
    });
  });

  return signals;
}

function evaluateAllMatches(matches, snapshots, patterns, existingSignals = []) {
  const signals = [];

  matches.filter((match) => match.status === "live" || match.status === "halftime").forEach((match) => {
    const snapshot = snapshots.find((item) => item.matchId === match.id);
    if (!snapshot) return;
    evaluateMatch(match, snapshot, patterns, [...existingSignals, ...signals]).forEach((signal) => {
      if (!hasDuplicateSignal([...existingSignals, ...signals], signal)) {
        signals.push(signal);
      }
    });
  });

  return signals.sort((a, b) => b.pressureScore - a.pressureScore);
}

function evaluatePattern(match, snapshot, pattern, side) {
  const team = snapshot[side];
  const opponent = snapshot[side === "home" ? "away" : "home"];
  const pressureScore = calculatePressureScore(team);
  const scoreDifference = Math.abs(match.scoreHome - match.scoreAway);
  const teamIsLosing = side === "home" ? match.scoreHome < match.scoreAway : match.scoreAway < match.scoreHome;
  const recent = snapshot.last10?.[side] || snapshot.recent?.[side] || team;
  const previous = snapshot.previous10?.[side] || snapshot.previous?.[side] || team;
  const rules = getRuleValues(pattern);

  const checks = {
    pressure_without_goal:
      match.minute >= getRuleValue(rules, "minute", ">=", 25) &&
      match.minute <= getRuleValue(rules, "minute", "<=", 70) &&
      match.scoreHome + match.scoreAway === getRuleValue(rules, "scoreTotal", "==", 0) &&
      team.dangerousAttacks >= getRuleValue(rules, "dangerousAttacks", ">=", 50) &&
      team.shotsTotal >= getRuleValue(rules, "shotsTotal", ">=", 8) &&
      team.shotsOnTarget >= getRuleValue(rules, "shotsOnTarget", ">=", 2) &&
      team.corners >= getRuleValue(rules, "corners", ">=", 3) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 70),
    late_goal:
      match.minute >= getRuleValue(rules, "minute", ">=", 65) &&
      scoreDifference <= getRuleValue(rules, "scoreDiff", "<=", 1) &&
      team.dangerousAttacks >= getRuleValue(rules, "dangerousAttacks", ">=", 45) &&
      team.shotsTotal >= getRuleValue(rules, "shotsTotal", ">=", 7) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 65),
    favorite_losing_but_pressing:
      teamIsLosing &&
      team.dangerousAttacks >= opponent.dangerousAttacks * getRuleValue(rules, "dangerousRatio", ">=", 1.6) &&
      team.shotsTotal >= opponent.shotsTotal * getRuleValue(rules, "shotsRatio", ">=", 1.4) &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 65),
    match_woke_up:
      match.minute >= getRuleValue(rules, "minute", ">=", 30) &&
      recent.dangerousAttacks >= previous.dangerousAttacks * getRuleValue(rules, "dangerousAttacks", ">=", 1.7, "last_10") &&
      recent.shotsTotal >= getRuleValue(rules, "shotsTotal", ">=", 2, "last_10") &&
      pressureScore >= getRuleValue(rules, "pressureScore", ">=", 60),
    corner_pressure:
      match.minute >= getRuleValue(rules, "minute", ">=", 20) &&
      team.attacks >= getRuleValue(rules, "attacks", ">=", 60) &&
      team.dangerousAttacks >= getRuleValue(rules, "dangerousAttacks", ">=", 40) &&
      team.corners >= getRuleValue(rules, "corners", ">=", 4),
    empty_pressure:
      team.attacks >= getRuleValue(rules, "attacks", ">=", 70) &&
      team.dangerousAttacks >= getRuleValue(rules, "dangerousAttacks", ">=", 45) &&
      team.shotsOnTarget <= getRuleValue(rules, "shotsOnTarget", "<=", 1) &&
      team.corners <= getRuleValue(rules, "corners", "<=", 2)
  };

  if (!checks[pattern.type]) {
    return null;
  }

  return {
    id: `${match.id}-${pattern.id}-${side}-${Math.floor(match.minute / SIGNAL_BUCKET_MINUTES)}`,
    matchId: match.id,
    patternId: pattern.id,
    patternType: pattern.type,
    teamId: side === "home" ? match.homeTeamId : match.awayTeamId,
    teamSide: side,
    minute: match.minute,
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
    pressureScore,
    strength: getSignalStrength(pressureScore),
    status: getPatternStatus(pattern.type),
    signalKind: pattern.type === "empty_pressure" ? "warning" : "signal",
    statsAtSignal: { ...team },
    explanation: buildSignalExplanation(pattern.type, match, team, opponent, side, pressureScore, recent, previous),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function getRuleValues(pattern) {
  return (pattern.rules || []).map((rule) => ({
    ...rule,
    numericValue: parseRuleNumber(rule.value)
  }));
}

function getRuleValue(rules, field, operator, fallback, period = null) {
  const rule = rules.find((item) =>
    item.field === field &&
    item.operator === operator &&
    (period ? item.period === period : !item.period)
  );
  return Number.isFinite(rule?.numericValue) ? rule.numericValue : fallback;
}

function parseRuleNumber(value) {
  if (typeof value === "number") return value;
  const clean = String(value).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return clean ? Number(clean[0]) : null;
}

function hasDuplicateSignal(signals, candidate) {
  return signals.some((signal) =>
    signal.matchId === candidate.matchId &&
    signal.patternId === candidate.patternId &&
    signal.teamSide === candidate.teamSide &&
    Math.abs(Number(signal.minute || 0) - Number(candidate.minute || 0)) < SIGNAL_BUCKET_MINUTES
  );
}

function buildSignalExplanation(type, match, team, opponent, side, pressureScore, recent, previous) {
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const opponentName = side === "home" ? match.awayTeam : match.homeTeam;
  const score = `${match.scoreHome}:${match.scoreAway}`;
  const dangerousRatio = opponent.dangerousAttacks ? (team.dangerousAttacks / opponent.dangerousAttacks).toFixed(1) : "∞";
  const shotsRatio = opponent.shotsTotal ? (team.shotsTotal / opponent.shotsTotal).toFixed(1) : "∞";
  const recentGrowth = previous.dangerousAttacks ? Math.round((recent.dangerousAttacks / previous.dangerousAttacks) * 100) : 0;

  const explanations = {
    pressure_without_goal:
      `${teamName}: счет ${score}, ${team.dangerousAttacks} опасных атак, ${team.shotsTotal} ударов, ${team.corners} угловых, индекс давления ${pressureScore}. Давление есть, голов пока нет.`,
    late_goal:
      `${teamName}: ${match.minute}-я минута, разница в счете не больше одного мяча, ${team.dangerousAttacks} опасных атак и индекс давления ${pressureScore}. Матч остается активным в поздней фазе.`,
    favorite_losing_but_pressing:
      `${teamName} уступает в счете, но давит сильнее ${opponentName}: опасные атаки x${dangerousRatio}, удары x${shotsRatio}, индекс давления ${pressureScore}.`,
    match_woke_up:
      `${teamName}: последние 10 минут заметно активнее предыдущего отрезка, рост опасных атак до ${recentGrowth}%, ударов за отрезок ${recent.shotsTotal}, индекс давления ${pressureScore}.`,
    corner_pressure:
      `${teamName}: ${team.attacks} атак, ${team.dangerousAttacks} опасных атак и ${team.corners} угловых. Команда регулярно доводит атаки до давления у ворот.`,
    empty_pressure:
      `${teamName}: атак много (${team.attacks}), опасных атак ${team.dangerousAttacks}, но ударов в створ ${team.shotsOnTarget} и угловых ${team.corners}. Давление может быть низкого качества.`
  };

  return explanations[type] || `${teamName}: найдено совпадение с условиями паттерна, индекс давления ${pressureScore}.`;
}

window.FootballPatternEngine = {
  calculatePressureScore,
  evaluateAllMatches,
  evaluateMatch,
  evaluatePattern,
  getSignalStrength,
  getPatternStatus
};
})();
