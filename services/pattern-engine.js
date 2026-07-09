const SIGNAL_BUCKET_MINUTES = 10;

function calculatePressureScore(stats) {
  const xgScore = typeof stats.xg === "number" ? stats.xg * 15 : 0;
  const score =
    stats.dangerousAttacks * 0.8 +
    stats.shotsTotal * 3 +
    stats.shotsOnTarget * 6 +
    stats.corners * 4 +
    xgScore;

  return Math.min(100, Math.round(score));
}

function getSignalStrength(score) {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MED";
  return "LOW";
}

function getPatternStatus(patternType) {
  return patternType === "empty_pressure" ? "new" : "in_progress";
}

function evaluateMatch(match, snapshot, patterns) {
  const signals = [];

  patterns.filter((pattern) => pattern.enabled).forEach((pattern) => {
    ["home", "away"].forEach((side) => {
      const signal = evaluatePattern(match, snapshot, pattern, side);
      if (signal && !hasDuplicateSignal(signals, signal)) {
        signals.push(signal);
      }
    });
  });

  return signals;
}

function evaluateAllMatches(matches, snapshots, patterns) {
  const signals = [];

  matches.filter((match) => match.status === "live" || match.status === "halftime").forEach((match) => {
    const snapshot = snapshots.find((item) => item.matchId === match.id);
    if (!snapshot) return;
    evaluateMatch(match, snapshot, patterns).forEach((signal) => {
      if (!hasDuplicateSignal(signals, signal)) {
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
  const recent = snapshot.recent?.[side] || team;
  const previous = snapshot.previous?.[side] || team;

  const checks = {
    pressure_without_goal:
      match.minute >= 25 &&
      match.minute <= 70 &&
      match.scoreHome + match.scoreAway === 0 &&
      team.dangerousAttacks >= 50 &&
      team.shotsTotal >= 8 &&
      team.shotsOnTarget >= 2 &&
      team.corners >= 3 &&
      pressureScore >= 70,
    late_goal:
      match.minute >= 65 &&
      scoreDifference <= 1 &&
      team.dangerousAttacks >= 45 &&
      team.shotsTotal >= 7 &&
      pressureScore >= 65,
    favorite_losing_but_pressing:
      teamIsLosing &&
      team.dangerousAttacks >= opponent.dangerousAttacks * 1.6 &&
      team.shotsTotal >= opponent.shotsTotal * 1.4 &&
      pressureScore >= 65,
    match_woke_up:
      match.minute >= 30 &&
      recent.dangerousAttacks >= previous.dangerousAttacks * 1.7 &&
      recent.shotsTotal >= 2 &&
      pressureScore >= 60,
    corner_pressure:
      match.minute >= 20 &&
      team.attacks >= 60 &&
      team.dangerousAttacks >= 40 &&
      team.corners >= 4,
    empty_pressure:
      team.attacks >= 70 &&
      team.dangerousAttacks >= 45 &&
      team.shotsOnTarget <= 1 &&
      team.corners <= 2
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
    statsAtSignal: { ...team },
    explanation: buildSignalExplanation(pattern.type, match, team, opponent, side, pressureScore, recent, previous),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function hasDuplicateSignal(signals, candidate) {
  return signals.some((signal) =>
    signal.matchId === candidate.matchId &&
    signal.patternId === candidate.patternId &&
    signal.teamSide === candidate.teamSide &&
    Math.floor(signal.minute / SIGNAL_BUCKET_MINUTES) === Math.floor(candidate.minute / SIGNAL_BUCKET_MINUTES)
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
