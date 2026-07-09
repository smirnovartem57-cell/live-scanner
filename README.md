# Football Pattern Lab / Live Scanner

Закрытое PWA/веб-приложение для личного анализа live-статистики футбольных матчей.

Приложение показывает нейтральные аналитические сигналы: давление, темп, активность и найденные игровые паттерны. В проекте нет финансовых метрик, промо-ссылок и внешних рекомендаций.

## Что реализовано в mock MVP

- Экран `Лайв-сканер` с карточками live-матчей.
- Фильтры Live Scanner: `Все`, `0:0`, `60+`, `Топ лиги`, `Мои`, `HIGH`, `MED`, `LOW`.
- Карточки матчей показывают подпись `Обнаружен паттерн`, pressure score, силу сигнала и тренд.
- Внутренняя навигация: `Лайв`, `Сигналы`, `Паттерны`, `История`, `Статистика`, `Настройки`.
- Темная premium sports analytics тема.
- Mobile bottom navigation и desktop sidebar.
- Расчет индекса давления.
- Pattern engine для 6 MVP-паттернов:
  - `Давят без гола`
  - `Поздняя активность`
  - `Матч ожил`
  - `Проигрывает, но давит`
  - `Давление на угловой`
  - `Пустое давление`
- Защита от дублей по `matchId + patternId + teamSide + time bucket`.
- История сигналов, ручное закрытие Win/Lose, комментарии и статистика по паттернам.
- Фильтры истории: `Все`, `Win`, `Lose`, `В процессе`.
- Периоды статистики: `Сегодня`, `7 дней`, `Всё время`.
- Экспорт истории в `JSON` и `CSV`.
- Профиль команды при клике по названию в карточке матча.
- Пометки качества паттернов: `Стабильный`, `Наблюдать`, `Слабый`, `Мало данных`.
- Экран настроек подготовлен к будущему real football API и личному профилю.
- UI-заглушка Telegram-уведомлений.
- PWA manifest и service worker.

## Как открыть

Откройте файл:

```text
C:\ChatGPT\live-scanner\index.html
```

Проект сделан как статический SPA, поэтому для текущей версии сборка не нужна.

Если нужен локальный сервер:

```powershell
cd "C:\ChatGPT\live-scanner"
python -m http.server 4173
```

После этого откройте:

```text
http://localhost:4173
```

После отдельной публикации на GitHub Pages проект должен быть доступен на отдельном поддомене:

```text
https://live-scanner.smirart.ru/
```

## Где лежит логика

Сейчас MVP собран без зависимостей, чтобы его можно было открыть сразу:

```text
index.html      оболочка приложения
styles.css      темная тема, desktop и mobile layout
app.js          экранная логика, журнал, pattern engine
data/mock-data.js
                mock-матчи, статистика, сигналы, паттерны, команды и стартовая история
services/football-provider.js
                слой данных, который позже заменяется на реальный API
manifest.webmanifest
sw.js
icons/icon.svg
```

Внутри `app.js` есть отдельные логические блоки:

- `calculatePressureScore(stats)`
- `getSignalStrength(score)`
- `evaluatePattern(match, snapshot, pattern, side)`
- `evaluateAllMatches()`
- журнал событий и расчёт win/lose

## Формула индекса давления

```text
pressure_score =
  dangerousAttacks * 0.8
+ shotsTotal * 3
+ shotsOnTarget * 6
+ corners * 4
+ xg * 15
```

Результат ограничивается диапазоном `0-100`.

Градации:

```text
LOW: 0-49
MED: 50-74
HIGH: 75-100
```

## Как добавлять паттерны

Добавьте новый объект в массив `mockPatterns` в `data/mock-data.js`, затем добавьте проверку в `evaluatePattern()` в `app.js`.

Минимальная структура:

```js
{
  id: "new_pattern",
  name: "Название",
  description: "Описание",
  enabled: true,
  type: "new_pattern",
  rules: []
}
```

## Подготовка под реальный API

В текущем MVP используется mock mode. При переходе к API стоит вынести слой данных в интерфейс:

```ts
interface FootballDataProvider {
  getLiveMatches(): Promise<Match[]>;
  getMatchStats(matchId: string): Promise<MatchStatsSnapshot>;
  getMatchEvents?(matchId: string): Promise<any[]>;
}
```

Текущая реализация уже вынесена в:

```text
services/football-provider.js
```

Планируемые реализации:

```text
MockFootballProvider
RealFootballProvider
```

## Env на будущее

```text
VITE_DATA_MODE=mock
VITE_FOOTBALL_API_PROVIDER=mock
VITE_FOOTBALL_API_KEY=
VITE_TELEGRAM_BOT_TOKEN=
VITE_TELEGRAM_CHAT_ID=
```
