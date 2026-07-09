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

function recentMatch(date, opponent, score, tournament, status, importanceLevel = "medium", importanceReason = "manual") {
  return { date, opponent, score, tournament, status, importanceLevel, importanceReason };
}

function teamPattern(teamId, patternId, patternName, totalSignals, successWithin10, successWithin15, averageMinute, averagePressureScore, label) {
  return {
    teamId,
    patternId,
    patternName,
    totalSignals,
    successWithin10,
    successWithin15,
    successRate10: Math.round((successWithin10 / totalSignals) * 100),
    successRate15: Math.round((successWithin15 / totalSignals) * 100),
    averageMinute,
    averagePressureScore,
    label
  };
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
  { id: "m1", league: "Spain LaLiga", country: "Spain", homeTeamId: "barcelona", awayTeamId: "valencia", homeTeam: "Barcelona", awayTeam: "Valencia", minute: 64, status: "live", scoreHome: 0, scoreAway: 0, isTopLeague: true },
  { id: "m2", league: "Italy Serie A", country: "Italy", homeTeamId: "atalanta", awayTeamId: "lazio", homeTeam: "Atalanta", awayTeam: "Lazio", minute: 73, status: "live", scoreHome: 1, scoreAway: 1, isTopLeague: true },
  { id: "m3", league: "Portugal Primeira", country: "Portugal", homeTeamId: "benfica", awayTeamId: "porto", homeTeam: "Benfica", awayTeam: "Porto", minute: 45, status: "halftime", scoreHome: 0, scoreAway: 1, isTopLeague: true },
  { id: "m4", league: "Japan J2 League", country: "Japan", homeTeamId: "kofu", awayTeamId: "iwaki", homeTeam: "Kofu", awayTeam: "Iwaki", minute: 82, status: "live", scoreHome: 1, scoreAway: 2, isTopLeague: false },
  { id: "m5", league: "Portugal Liga 2", country: "Portugal", homeTeamId: "leiria", awayTeamId: "tondela", homeTeam: "Leiria", awayTeam: "Tondela", minute: 68, status: "live", scoreHome: 0, scoreAway: 0, isTopLeague: false }
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
  history("Atalanta - Lazio", "Italy Serie A", 72, "match_woke_up", "match_woke_up", "1:1", "success", { goalWithin5: false, goalWithin10: true, goalWithin15: true }),
  history("Benfica - Porto", "Portugal Primeira", 66, "late_goal", "late_goal", "0:1", "failed", { goalWithin5: false, goalWithin10: false, goalWithin15: false }),
  history("Kofu - Oita", "Japan J2 League", 78, "late_goal", "late_goal", "1:1", "success", { goalWithin5: true, goalWithin10: true, goalWithin15: true }),
  history("Avai - Ceara", "Brazil Serie B", 54, "empty_pressure", "empty_pressure", "0:0", "failed", { goalWithin5: false, goalWithin10: false, goalWithin15: false }),
  history("Leiria - Mafra", "Portugal Liga 2", 66, "corner_pressure", "corner_pressure", "1:1", "in_progress", { goalWithin5: false, goalWithin10: false, goalWithin15: false }),
  history("Orebro - Utsikten", "Sweden Superettan", 71, "match_woke_up", "match_woke_up", "0:1", "success", { goalWithin5: false, goalWithin10: false, goalWithin15: true })
];

const mockSignals = [
  { id: "seed-m1-pressure-home", matchId: "m1", patternId: "pressure_without_goal", teamId: "barcelona", teamSide: "home", minute: 64, scoreHome: 0, scoreAway: 0, pressureScore: 100, strength: "HIGH", status: "in_progress", createdAt: "2026-07-09T10:10:00.000Z" },
  { id: "seed-m2-woke-away", matchId: "m2", patternId: "match_woke_up", teamId: "lazio", teamSide: "away", minute: 73, scoreHome: 1, scoreAway: 1, pressureScore: 85, strength: "HIGH", status: "in_progress", createdAt: "2026-07-09T10:12:00.000Z" },
  { id: "seed-m3-late-away", matchId: "m3", patternId: "late_goal", teamId: "porto", teamSide: "away", minute: 45, scoreHome: 0, scoreAway: 1, pressureScore: 68, strength: "MED", status: "in_progress", createdAt: "2026-07-09T10:15:00.000Z" },
  { id: "seed-m5-corner-home", matchId: "m5", patternId: "corner_pressure", teamId: "leiria", teamSide: "home", minute: 68, scoreHome: 0, scoreAway: 0, pressureScore: 74, strength: "MED", status: "in_progress", createdAt: "2026-07-09T10:18:00.000Z" }
];

const mockTeamProfiles = [
  {
    id: "barcelona",
    name: "Barcelona",
    country: "Spain",
    league: "Spain LaLiga",
    logo: "BAR",
    recentMatches: [
      recentMatch("2026-07-05", "Valencia", "2:0", "Spain LaLiga", "win", "high", "top_opponent"),
      recentMatch("2026-06-29", "Sevilla", "1:1", "Spain LaLiga", "draw"),
      recentMatch("2026-06-22", "Betis", "3:1", "Spain LaLiga", "win"),
      recentMatch("2026-06-15", "Atletico", "0:1", "Spain LaLiga", "loss", "high", "top_opponent"),
      recentMatch("2026-06-08", "Villarreal", "2:2", "Spain LaLiga", "draw")
    ],
    averages: { matchesCount: 10, wins: 6, draws: 3, losses: 1, goalsFor: 1.9, goalsAgainst: 0.8, shotsTotal: 14.4, shotsOnTarget: 5.8, corners: 6.2, attacks: 82, dangerousAttacks: 55, pressureScore: 78 },
    firstHalfAverages: { dangerousAttacks: 24, shotsTotal: 6.1, shotsOnTarget: 2.4, corners: 2.7, pressureScore: 41 },
    secondHalfAverages: { dangerousAttacks: 31, shotsTotal: 8.3, shotsOnTarget: 3.4, corners: 3.5, pressureScore: 52 },
    characteristicPatterns: [
      teamPattern("barcelona", "pressure_without_goal", "Давят без гола", 18, 7, 10, 58, 76, "strong"),
      teamPattern("barcelona", "corner_pressure", "Давление на угловой", 14, 5, 8, 63, 72, "normal")
    ],
    importantMatches: [
      { matchId: "tm-bar-1", date: "2026-07-05", opponent: "Valencia", score: "2:0", tournament: "Spain LaLiga", importanceLevel: "high", importanceReason: "top_opponent", teamStats: team(86, 58, 16, 7, 8, 62, 1.94), triggeredPatterns: ["Давят без гола", "Давление на угловой"] }
    ],
    updatedAt: "2026-07-09T10:00:00.000Z"
  },
  {
    id: "valencia",
    name: "Valencia",
    country: "Spain",
    league: "Spain LaLiga",
    logo: "VAL",
    recentMatches: [
      recentMatch("2026-07-05", "Barcelona", "0:2", "Spain LaLiga", "loss", "high", "top_opponent"),
      recentMatch("2026-06-28", "Getafe", "1:0", "Spain LaLiga", "win"),
      recentMatch("2026-06-21", "Osasuna", "1:1", "Spain LaLiga", "draw"),
      recentMatch("2026-06-14", "Girona", "2:1", "Spain LaLiga", "win"),
      recentMatch("2026-06-07", "Betis", "0:0", "Spain LaLiga", "draw")
    ],
    averages: { matchesCount: 10, wins: 4, draws: 3, losses: 3, goalsFor: 1.2, goalsAgainst: 1.1, shotsTotal: 10.6, shotsOnTarget: 3.7, corners: 4.8, attacks: 64, dangerousAttacks: 39, pressureScore: 61 },
    firstHalfAverages: { dangerousAttacks: 17, shotsTotal: 4.2, shotsOnTarget: 1.5, corners: 2.1, pressureScore: 29 },
    secondHalfAverages: { dangerousAttacks: 22, shotsTotal: 6.4, shotsOnTarget: 2.2, corners: 2.7, pressureScore: 36 },
    characteristicPatterns: [
      teamPattern("valencia", "empty_pressure", "Пустое давление", 9, 1, 2, 67, 58, "weak"),
      teamPattern("valencia", "late_goal", "Поздняя активность", 7, 2, 3, 74, 64, "normal")
    ],
    importantMatches: [
      { matchId: "tm-val-1", date: "2026-07-05", opponent: "Barcelona", score: "0:2", tournament: "Spain LaLiga", importanceLevel: "high", importanceReason: "top_opponent", teamStats: team(46, 21, 7, 2, 3, 38, 0.62), triggeredPatterns: ["Пустое давление"] }
    ],
    updatedAt: "2026-07-09T10:00:00.000Z"
  },
  {
    id: "atalanta",
    name: "Atalanta",
    country: "Italy",
    league: "Italy Serie A",
    logo: "ATA",
    recentMatches: [
      recentMatch("2026-07-04", "Lazio", "2:2", "Italy Serie A", "draw", "high", "top_opponent"),
      recentMatch("2026-06-27", "Torino", "3:0", "Italy Serie A", "win"),
      recentMatch("2026-06-20", "Roma", "1:2", "Italy Serie A", "loss", "high", "top_opponent")
    ],
    averages: { matchesCount: 10, wins: 5, draws: 2, losses: 3, goalsFor: 1.7, goalsAgainst: 1.3, shotsTotal: 13.1, shotsOnTarget: 4.9, corners: 5.4, attacks: 72, dangerousAttacks: 47, pressureScore: 70 },
    firstHalfAverages: { dangerousAttacks: 20, shotsTotal: 5.3, shotsOnTarget: 1.9, corners: 2.2, pressureScore: 34 },
    secondHalfAverages: { dangerousAttacks: 27, shotsTotal: 7.8, shotsOnTarget: 3, corners: 3.2, pressureScore: 45 },
    characteristicPatterns: [teamPattern("atalanta", "match_woke_up", "Матч ожил", 16, 6, 9, 61, 71, "strong")],
    importantMatches: [{ matchId: "tm-ata-1", date: "2026-07-04", opponent: "Lazio", score: "2:2", tournament: "Italy Serie A", importanceLevel: "high", importanceReason: "top_opponent", teamStats: team(75, 50, 14, 6, 6, 53, 1.42), triggeredPatterns: ["Матч ожил"] }],
    updatedAt: "2026-07-09T10:00:00.000Z"
  },
  {
    id: "lazio",
    name: "Lazio",
    country: "Italy",
    league: "Italy Serie A",
    logo: "LAZ",
    recentMatches: [recentMatch("2026-07-04", "Atalanta", "2:2", "Italy Serie A", "draw", "high", "top_opponent"), recentMatch("2026-06-26", "Bologna", "1:0", "Italy Serie A", "win"), recentMatch("2026-06-18", "Milan", "0:1", "Italy Serie A", "loss", "high", "top_opponent")],
    averages: { matchesCount: 10, wins: 4, draws: 4, losses: 2, goalsFor: 1.3, goalsAgainst: 1.0, shotsTotal: 11.8, shotsOnTarget: 4.1, corners: 4.9, attacks: 68, dangerousAttacks: 42, pressureScore: 65 },
    firstHalfAverages: { dangerousAttacks: 18, shotsTotal: 4.7, shotsOnTarget: 1.6, corners: 2, pressureScore: 31 },
    secondHalfAverages: { dangerousAttacks: 24, shotsTotal: 7.1, shotsOnTarget: 2.5, corners: 2.9, pressureScore: 40 },
    characteristicPatterns: [teamPattern("lazio", "late_goal", "Поздняя активность", 11, 3, 5, 76, 66, "normal")],
    importantMatches: [{ matchId: "tm-laz-1", date: "2026-07-04", opponent: "Atalanta", score: "2:2", tournament: "Italy Serie A", importanceLevel: "high", importanceReason: "top_opponent", teamStats: team(69, 44, 12, 5, 5, 47, 1.12), triggeredPatterns: ["Поздняя активность"] }],
    updatedAt: "2026-07-09T10:00:00.000Z"
  },
  {
    id: "benfica",
    name: "Benfica",
    country: "Portugal",
    league: "Portugal Primeira",
    logo: "BEN",
    recentMatches: [recentMatch("2026-07-03", "Porto", "1:1", "Portugal Primeira", "draw", "high", "derby"), recentMatch("2026-06-25", "Braga", "2:1", "Portugal Primeira", "win"), recentMatch("2026-06-19", "Sporting", "0:0", "Portugal Primeira", "draw", "high", "derby")],
    averages: { matchesCount: 10, wins: 6, draws: 3, losses: 1, goalsFor: 1.8, goalsAgainst: 0.7, shotsTotal: 15.2, shotsOnTarget: 5.5, corners: 6.5, attacks: 84, dangerousAttacks: 53, pressureScore: 77 },
    firstHalfAverages: { dangerousAttacks: 25, shotsTotal: 6.5, shotsOnTarget: 2.3, corners: 3, pressureScore: 42 },
    secondHalfAverages: { dangerousAttacks: 28, shotsTotal: 8.7, shotsOnTarget: 3.2, corners: 3.5, pressureScore: 48 },
    characteristicPatterns: [teamPattern("benfica", "pressure_without_goal", "Давят без гола", 19, 6, 9, 57, 78, "strong"), teamPattern("benfica", "corner_pressure", "Давление на угловой", 15, 4, 7, 62, 74, "normal")],
    importantMatches: [{ matchId: "tm-ben-1", date: "2026-07-03", opponent: "Porto", score: "1:1", tournament: "Portugal Primeira", importanceLevel: "high", importanceReason: "derby", teamStats: team(80, 54, 15, 6, 7, 56, 1.58), triggeredPatterns: ["Давят без гола"] }],
    updatedAt: "2026-07-09T10:00:00.000Z"
  },
  {
    id: "porto",
    name: "Porto",
    country: "Portugal",
    league: "Portugal Primeira",
    logo: "POR",
    recentMatches: [recentMatch("2026-07-03", "Benfica", "1:1", "Portugal Primeira", "draw", "high", "derby"), recentMatch("2026-06-26", "Boavista", "2:0", "Portugal Primeira", "win"), recentMatch("2026-06-18", "Braga", "1:2", "Portugal Primeira", "loss", "high", "top_opponent")],
    averages: { matchesCount: 10, wins: 5, draws: 3, losses: 2, goalsFor: 1.6, goalsAgainst: 0.9, shotsTotal: 13.8, shotsOnTarget: 4.8, corners: 5.7, attacks: 77, dangerousAttacks: 49, pressureScore: 72 },
    firstHalfAverages: { dangerousAttacks: 21, shotsTotal: 5.5, shotsOnTarget: 1.9, corners: 2.5, pressureScore: 36 },
    secondHalfAverages: { dangerousAttacks: 28, shotsTotal: 8.3, shotsOnTarget: 2.9, corners: 3.2, pressureScore: 44 },
    characteristicPatterns: [teamPattern("porto", "favorite_losing_but_pressing", "Проигрывает, но давит", 8, 2, 3, 69, 68, "not_enough_data"), teamPattern("porto", "match_woke_up", "Матч ожил", 12, 4, 6, 64, 70, "normal")],
    importantMatches: [{ matchId: "tm-por-1", date: "2026-07-03", opponent: "Benfica", score: "1:1", tournament: "Portugal Primeira", importanceLevel: "high", importanceReason: "derby", teamStats: team(70, 46, 12, 5, 6, 44, 1.18), triggeredPatterns: ["Матч ожил"] }],
    updatedAt: "2026-07-09T10:00:00.000Z"
  }
];

const mockUserProfile = {
  id: "user-artem-demo",
  displayName: "Artem",
  handle: "artem-lab",
  role: "Личный аналитический профиль",
  accessLevel: "private_mvp",
  joinedAt: "2026-07-09T10:00:00.000Z",
  publicProfileReady: false,
  avatar: "AR",
  bio: "Собирает live-сигналы, проверяет паттерны и ведет честную историю результатов.",
  socialTrust: {
    score: 62,
    level: "Ранний профиль",
    verifiedSignals: 42,
    reviewedIdeas: 6,
    sharedReports: 0,
    notes: [
      "История сигналов хранится локально",
      "Публичная страница профиля пока не включена",
      "Репутация будет расти от проверенных аналитических действий"
    ]
  },
  permissions: [
    { key: "view_live", label: "Просмотр live-матчей", status: "active" },
    { key: "edit_patterns", label: "Редактирование паттернов", status: "active" },
    { key: "public_profile", label: "Публичный профиль", status: "planned" },
    { key: "team_notes", label: "Заметки по командам", status: "planned" }
  ],
  futureFields: ["authProvider", "profileSlug", "publicStats", "followers", "trustedBy"]
};

const mockFeedbackItems = [
  {
    id: "idea-team-notes",
    type: "idea",
    title: "Заметки по командам",
    description: "Добавить личные заметки в профиль команды и показывать их рядом с характерными паттернами.",
    status: "planned",
    priority: "high",
    votes: 12,
    createdAt: "2026-07-09T10:20:00.000Z"
  },
  {
    id: "idea-signal-review",
    type: "idea",
    title: "Разбор сигнала после матча",
    description: "После закрытия события показывать короткий разбор: какие условия подтвердились, какие были слабее.",
    status: "in_review",
    priority: "high",
    votes: 9,
    createdAt: "2026-07-09T10:25:00.000Z"
  },
  {
    id: "feedback-mobile-table",
    type: "feedback",
    title: "Упростить таблицу истории на телефоне",
    description: "На узком экране оставить главные поля, а подробности раскрывать по нажатию.",
    status: "next",
    priority: "medium",
    votes: 5,
    createdAt: "2026-07-09T10:28:00.000Z"
  },
  {
    id: "idea-api-monitor",
    type: "idea",
    title: "Монитор качества источника данных",
    description: "Показывать задержку обновления матчей, полноту статистики и время последнего снимка.",
    status: "planned",
    priority: "medium",
    votes: 7,
    createdAt: "2026-07-09T10:31:00.000Z"
  }
];

window.FootballMockData = {
  matches: mockMatches,
  snapshots: mockSnapshots,
  signals: mockSignals,
  patterns: mockPatterns,
  history: mockHistory,
  teamProfiles: mockTeamProfiles,
  userProfile: mockUserProfile,
  feedbackItems: mockFeedbackItems
};
