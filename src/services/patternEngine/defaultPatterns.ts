import type { Pattern } from "../../types/patterns.ts";

export const defaultPatterns: Pattern[] = [
  {
    id: "pressure_without_goal",
    name: "Давят без гола",
    description: "Команда создаёт давление, но счёт остаётся без голов.",
    enabled: true,
    type: "pressure_without_goal",
    rules: [
      { label: "Минута от", field: "minute", operator: ">=", value: 25 },
      { label: "Минута до", field: "minute", operator: "<=", value: 75 },
      { label: "Голов в матче", field: "scoreTotal", operator: "==", value: 0 },
      { label: "Удары", field: "shotsTotal", operator: ">=", value: 8 },
      { label: "Удары в створ", field: "shotsOnTarget", operator: ">=", value: 2 },
      { label: "Угловые", field: "corners", operator: ">=", value: 3 },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 55 }
    ]
  },
  {
    id: "late_goal",
    name: "Поздний гол",
    description: "После 65-й минуты давление растёт при небольшой разнице в счёте.",
    enabled: true,
    type: "late_goal",
    rules: [
      { label: "Минута от", field: "minute", operator: ">=", value: 65 },
      { label: "Разница в счёте", field: "scoreDiff", operator: "<=", value: 1 },
      { label: "Удары", field: "shotsTotal", operator: ">=", value: 7 },
      { label: "Удары в створ", field: "shotsOnTarget", operator: ">=", value: 2 },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 50 }
    ]
  },
  {
    id: "match_woke_up",
    name: "Матч ожил",
    description: "После 30-й минуты команда создаёт плотный поток ударов и угловых.",
    enabled: true,
    type: "match_woke_up",
    rules: [
      { label: "Минута от", field: "minute", operator: ">=", value: 30 },
      { label: "Удары", field: "shotsTotal", operator: ">=", value: 6 },
      { label: "Удары в створ", field: "shotsOnTarget", operator: ">=", value: 2 },
      { label: "Угловые", field: "corners", operator: ">=", value: 2 },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 45 }
    ]
  },
  {
    id: "favorite_losing_but_pressing",
    name: "Проигрывает, но давит",
    description: "Команда уступает в счёте, но превосходит соперника по давлению.",
    enabled: true,
    type: "favorite_losing_but_pressing",
    rules: [
      { label: "Команда проигрывает", field: "teamLosing", operator: "==", value: "true" },
      { label: "Минимум ударов", field: "shotsTotal", operator: ">=", value: 5 },
      { label: "Превосходство по ударам", field: "shotsRatio", operator: ">=", value: 1.4 },
      { label: "Удары в створ", field: "shotsOnTarget", operator: ">=", value: 2 },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 45 }
    ]
  },
  {
    id: "corner_pressure",
    name: "Давление на угловой",
    description: "Удары, владение и угловые указывают на устойчивое давление.",
    enabled: true,
    type: "corner_pressure",
    rules: [
      { label: "Минута от", field: "minute", operator: ">=", value: 20 },
      { label: "Удары", field: "shotsTotal", operator: ">=", value: 6 },
      { label: "Угловые", field: "corners", operator: ">=", value: 4 },
      { label: "Владение", field: "possession", operator: ">=", value: 52 }
    ]
  },
  {
    id: "empty_pressure",
    name: "Пустое давление",
    description: "Команда владеет мячом и бьёт, но почти не попадает в створ.",
    enabled: true,
    type: "empty_pressure",
    rules: [
      { label: "Владение", field: "possession", operator: ">=", value: 58 },
      { label: "Удары", field: "shotsTotal", operator: ">=", value: 7 },
      { label: "Удары в створ", field: "shotsOnTarget", operator: "<=", value: 1 },
      { label: "Индекс давления", field: "pressureScore", operator: ">=", value: 30 }
    ]
  }
];
