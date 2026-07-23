import type { Pattern } from "../../types/patterns.ts";

export const defaultPatterns: Pattern[] = [
  {
    id: "pressure_without_goal",
    name: "Давят без гола",
    description: "Команда создаёт давление, но счёт остаётся без голов.",
    enabled: true,
    type: "pressure_without_goal",
    rules: [
      { field: "minute", operator: ">=", value: 25 },
      { field: "minute", operator: "<=", value: 70 },
      { field: "scoreTotal", operator: "==", value: 0 },
      { field: "dangerousAttacks", operator: ">=", value: 50 },
      { field: "shotsTotal", operator: ">=", value: 8 },
      { field: "shotsOnTarget", operator: ">=", value: 2 },
      { field: "corners", operator: ">=", value: 3 },
      { field: "pressureScore", operator: ">=", value: 70 }
    ]
  },
  {
    id: "late_goal",
    name: "Поздний гол",
    description: "После 65-й минуты давление растёт при небольшой разнице в счёте.",
    enabled: true,
    type: "late_goal",
    rules: [
      { field: "minute", operator: ">=", value: 65 },
      { field: "scoreDiff", operator: "<=", value: 1 },
      { field: "dangerousAttacks", operator: ">=", value: 45 },
      { field: "shotsTotal", operator: ">=", value: 7 },
      { field: "pressureScore", operator: ">=", value: 65 }
    ]
  },
  {
    id: "match_woke_up",
    name: "Матч ожил",
    description: "Темп последних минут заметно выше предыдущего отрезка.",
    enabled: true,
    type: "match_woke_up",
    rules: [
      { field: "minute", operator: ">=", value: 30 },
      { field: "dangerousAttacks", operator: ">=", value: 1.7, period: "last_10" },
      { field: "shotsTotal", operator: ">=", value: 2, period: "last_10" },
      { field: "pressureScore", operator: ">=", value: 60 }
    ]
  },
  {
    id: "favorite_losing_but_pressing",
    name: "Проигрывает, но давит",
    description: "Команда уступает в счёте, но превосходит соперника по давлению.",
    enabled: true,
    type: "favorite_losing_but_pressing",
    rules: [
      { field: "teamLosing", operator: "==", value: "true" },
      { field: "dangerousRatio", operator: ">=", value: 1.6 },
      { field: "shotsRatio", operator: ">=", value: 1.4 },
      { field: "pressureScore", operator: ">=", value: 65 }
    ]
  },
  {
    id: "corner_pressure",
    name: "Давление на угловой",
    description: "Атаки, опасные атаки и угловые идут плотным потоком.",
    enabled: true,
    type: "corner_pressure",
    rules: [
      { field: "minute", operator: ">=", value: 20 },
      { field: "attacks", operator: ">=", value: 60 },
      { field: "dangerousAttacks", operator: ">=", value: 40 },
      { field: "corners", operator: ">=", value: 4 }
    ]
  },
  {
    id: "empty_pressure",
    name: "Пустое давление",
    description: "Много общего давления, но мало реальной остроты.",
    enabled: true,
    type: "empty_pressure",
    rules: [
      { field: "attacks", operator: ">=", value: 70 },
      { field: "dangerousAttacks", operator: ">=", value: 45 },
      { field: "shotsOnTarget", operator: "<=", value: 1 },
      { field: "corners", operator: "<=", value: 2 }
    ]
  }
];
