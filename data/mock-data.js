function team(attacks, dangerousAttacks, shotsTotal, shotsOnTarget, corners, possession, xg) {
  return { attacks, dangerousAttacks, shotsTotal, shotsOnTarget, corners, possession, xg };
}

function snapshot(id, matchId, minute, home, away, recentHome, previousHome) {
  return {
    id,
    matchId,
    minute,
    createdAt: new Date().toISOString(),
    home,
    away,
    recent: {
      home: recentHome,
      away: {
        attacks: Math.max(3, Math.round(away.attacks * 0.14)),
        dangerousAttacks: Math.max(2, Math.round(away.dangerousAttacks * 0.18)),
        shotsTotal: Math.max(1, Math.round(away.shotsTotal * 0.2)),
        shotsOnTarget: Math.max(0, Math.round(away.shotsOnTarget * 0.2)),
        corners: Math.max(0, Math.round(away.corners * 0.2)),
        possession: away.possession,
        xg: Number((away.xg * 0.18).toFixed(2))
      }
    },
    previous: {
      home: previousHome,
      away: {
        attacks: Math.max(3, Math.round(away.attacks * 0.12)),
        dangerousAttacks: Math.max(2, Math.round(away.dangerousAttacks * 0.14)),
        shotsTotal: Math.max(1, Math.round(away.shotsTotal * 0.15)),
        shotsOnTarget: Math.max(0, Math.round(away.shotsOnTarget * 0.15)),
        corners: Math.max(0, Math.round(away.corners * 0.15)),
        possession: away.possession,
        xg: Number((away.xg * 0.12).toFixed(2))
      }
    }
  };
}

function history(match, league, minute, patternId, patternType, score, status, result) {
  return { match, league, minute, patternId, patternType, score, status, result };
}

const mockPatterns = [
  {
    id: "pressure_without_goal",
    name: "Давят без гола",
    description: "Команда создает давление, но счет остается без голов.",
    enabled: true,
    type: "pressure_without_goal",
    rules: [
      { label: "Минута", field: "minute", operator: ">=", value: 25 },
      { label: "Минута", field: "minute", operator: "<=", value: 70 },
      { label: "Счет", field: "scoreTotal", operator: "==", value: 0 },
      { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: 50 },
      { label: "Удары", field: "shotsTotal", operator: ">=", value: 8 },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 70 }
    ]
  },
  {
    id: "late_goal",
    name: "Поздняя активность",
    description: "После 65-й минуты давление растет при небольшой разнице в счете.",
    enabled: true,
    type: "late_goal",
    rules: [
      { label: "Минута", field: "minute", operator: ">=", value: 65 },
      { label: "Разница счета", field: "scoreDiff", operator: "<=", value: 1 },
      { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: 45 },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 65 }
    ]
  },
  {
    id: "match_woke_up",
    name: "Матч ожил",
    description: "Темп последних минут заметно выше предыдущего отрезка.",
    enabled: true,
    type: "match_woke_up",
    rules: [
      { label: "Минута", field: "minute", operator: ">=", value: 30 },
      { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: "previous * 1.7", period: "last_10" },
      { label: "Удары", field: "shotsTotal", operator: ">=", value: 2, period: "last_10" },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 60 }
    ]
  },
  {
    id: "favorite_losing_but_pressing",
    name: "Проигрывает, но давит",
    description: "Команда уступает в счете, но превосходит соперника по давлению.",
    enabled: true,
    type: "favorite_losing_but_pressing",
    rules: [
      { label: "Команда", field: "teamLosing", operator: "==", value: "true" },
      { label: "Опасные атаки", field: "dangerousRatio", operator: ">=", value: "x1.6" },
      { label: "Удары", field: "shotsRatio", operator: ">=", value: "x1.4" },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 65 }
    ]
  },
  {
    id: "corner_pressure",
    name: "Давление на угловой",
    description: "Атаки, опасные атаки и угловые идут плотным потоком.",
    enabled: true,
    type: "corner_pressure",
    rules: [
      { label: "Минута", field: "minute", operator: ">=", value: 20 },
      { label: "Атаки", field: "attacks", operator: ">=", value: 60 },
      { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: 40 },
      { label: "Угловые", field: "corners", operator: ">=", value: 4 }
    ]
  },
  {
    id: "empty_pressure",
    name: "Пустое давление",
    description: "Много общего давления, но мало реальной остроты.",
    enabled: true,
    type: "empty_pressure",
    rules: [
      { label: "Атаки", field: "attacks", operator: ">=", value: 70 },
      { label: "Опасные атаки", field: "dangerousAttacks", operator: ">=", value: 45 },
      { label: "В створ", field: "shotsOnTarget", operator: "<=", value: 1 },
      { label: "Угловые", field: "corners", operator: "<=", value: 2 }
    ]
  }
];

const mockMatches = [
  { id: "m1", league: "Portugal Liga 2", country: "Portugal", homeTeam: "Leiria", awayTeam: "Tondela", minute: 64, status: "live", scoreHome: 0, scoreAway: 0, isTopLeague: false },
  { id: "m2", league: "Sweden Superettan", country: "Sweden", homeTeam: "Orebro", awayTeam: "Vasteras", minute: 73, status: "live", scoreHome: 1, scoreAway: 1, isTopLeague: false },
  { id: "m3", league: "Brazil Serie B", country: "Brazil", homeTeam: "Avai", awayTeam: "Goias", minute: 45, status: "halftime", scoreHome: 0, scoreAway: 1, isTopLeague: false },
  { id: "m4", league: "Japan J2 League", country: "Japan", homeTeam: "Kofu", awayTeam: "Iwaki", minute: 82, status: "live", scoreHome: 1, scoreAway: 2, isTopLeague: false },
  { id: "m5", league: "Spain LaLiga", country: "Spain", homeTeam: "Valencia", awayTeam: "Betis", minute: 68, status: "live", scoreHome: 0, scoreAway: 0, isTopLeague: true }
];

const mockSnapshots = [
  snapshot("s1", "m1", 64, team(78, 56, 15, 6, 9, 58, 1.62), team(39, 13, 4, 1, 2, 42, 0.28), team(19, 15, 4, 2, 3, 61, 0.49), team(12, 6, 1, 0, 1, 39, 0.08)),
  snapshot("s2", "m2", 73, team(61, 29, 9, 3, 4, 49, 0.98), team(67, 36, 11, 5, 6, 51, 1.21), team(12, 10, 3, 1, 2, 48, 0.32), team(7, 5, 1, 1, 1, 52, 0.14)),
  snapshot("s3", "m3", 45, team(31, 11, 3, 1, 1, 45, 0.22), team(48, 26, 8, 4, 5, 55, 0.91), team(6, 3, 1, 0, 0, 45, 0.05), team(8, 5, 2, 1, 1, 55, 0.18)),
  snapshot("s4", "m4", 82, team(86, 51, 13, 5, 10, 57, 1.58), team(52, 21, 7, 3, 3, 43, 0.77), team(24, 18, 5, 2, 4, 59, 0.58), team(9, 4, 1, 0, 1, 41, 0.11)),
  snapshot("s5", "m5", 68, team(74, 52, 10, 3, 5, 54, 1.06), team(34, 17, 5, 1, 2, 46, 0.36), team(17, 14, 3, 1, 2, 54, 0.3), team(8, 5, 1, 0, 1, 46, 0.09))
];

const mockHistory = [
  history("Barcelona - Valencia", "Spain LaLiga", 62, "pressure_without_goal", "pressure_without_goal", "0:0", "success", { goalWithin5: false, goalWithin10: true, goalWithin15: true }),
  history("Kofu - Oita", "Japan J2 League", 78, "late_goal", "late_goal", "1:1", "success", { goalWithin5: true, goalWithin10: true, goalWithin15: true }),
  history("Avai - Ceara", "Brazil Serie B", 54, "empty_pressure", "empty_pressure", "0:0", "failed", { goalWithin5: false, goalWithin10: false, goalWithin15: false }),
  history("Leiria - Mafra", "Portugal Liga 2", 66, "corner_pressure", "corner_pressure", "1:1", "in_progress", { goalWithin5: false, goalWithin10: false, goalWithin15: false }),
  history("Orebro - Utsikten", "Sweden Superettan", 71, "match_woke_up", "match_woke_up", "0:1", "success", { goalWithin5: false, goalWithin10: false, goalWithin15: true })
];

window.FootballMockData = {
  matches: mockMatches,
  snapshots: mockSnapshots,
  patterns: mockPatterns,
  history: mockHistory
};
