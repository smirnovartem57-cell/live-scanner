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
  - `Поздний гол`
  - `Матч ожил`
  - `Проигрывает, но давит`
  - `Давление на угловой`
  - `Пустое давление`
- Защита от дублей по `matchId + patternId + teamSide` за последние 10 минут.
- История сигналов, ручное закрытие Win/Lose, комментарии и статистика по паттернам.
- Автоматическая проверка результата сигнала по mock-событиям матча в окнах 5/10/15 минут.
- История показывает источник результата, warning-паттерны и статистику на момент сигнала.
- Мобильная история отображается карточками вместо широкой таблицы.
- Фильтры истории: `Все`, `Win`, `Lose`, `В процессе`.
- Периоды статистики: `Сегодня`, `7 дней`, `Всё время`.
- Экспорт истории в `JSON` и `CSV`.
- Профиль команды при клике по названию в карточке матча.
- Локальные заметки, теги, важный матч и журнал заметок в профиле команды.
- Pattern Analytics с таблицей сигналов, подтверждений до 5/10/15 минут, средним pressure score, средней минутой и статусами.
- Сортировка Pattern Analytics по оценке, слабым паттернам, выборке и pressure score.
- Watchlist паттернов, которые требуют внимания или пересмотра условий.
- Локальный профиль условий паттерна: редактирование порогов, сброс и влияние на поиск сигналов.
- Именованные профили условий паттернов с применением, экспортом и импортом JSON.
- Монитор качества данных: покрытие статистики, покрытие событий, свежесть обновления и оценка качества источника.
- Статусы паттернов: `new`, `promising`, `working`, `weak`, `ineffective`, `testing`.
- Профиль команды показывает последние матчи, средние значения, средние по таймам, характерные паттерны и важные матчи.
- Экран настроек подготовлен к будущему real football API и личному профилю.
- В настройках добавлена проверка записи постоянного журнала через Supabase Edge Function.
- Экран истории умеет читать постоянный журнал через `journal-read`, если Supabase включен в настройках.
- Найденные сигналы автоматически записываются в постоянный журнал через `journal-ingest`, если Supabase включен.
- События журнала можно закрывать вручную как `Win` или `Lose` с комментарием, результат сохраняется в Supabase.
- FootballDataProvider с контрактом, MockFootballProvider и RealFootballProvider-заглушкой.
- RealFootballProvider подключается только к защищённой Supabase Edge Function `football-live`.
- UI Telegram-уведомлений и service-заглушка для тестового сообщения и отправки аналитического сигнала.
- Раздел `Профиль` с mock-архитектурой пользователя, будущего публичного профиля и социального доверия.
- Раздел `Идеи` с mock-данными для идей, feedback, статусов и приоритетов.
- PWA manifest и service worker.

## Как открыть

Для разработки React-версии:

```powershell
npm run dev:react
```

Открыть:

```text
http://127.0.0.1:5173/
```

Для проверки production-сборки:

```powershell
npm run build:react
npm run preview:react
```

После этого откройте:

```text
http://127.0.0.1:4173/
```

Публичная версия GitHub Pages открывает приложение:

```text
https://live-scanner.smirart.ru/
```

Интерфейс, статические файлы и mock/demo-данные могут быть публичными. Реальный журнал и real football API должны проходить только через Supabase Edge Functions с access token.

Проверка нормализации API-FOOTBALL:

```powershell
npm run test:api-football
```

## Где лежит логика

Сейчас MVP собран без зависимостей, чтобы его можно было открыть сразу:

```text
index.html      React-оболочка приложения
styles.css      темная тема, desktop и mobile layout
app.js          legacy-версия экранной логики для резерва
data/mock-data.js
                mock-матчи, статистика, сигналы, паттерны, команды, пользователь, идеи и стартовая история
services/football-provider.js
                слой данных, который позже заменяется на реальный API
supabase/functions/football-live/
                защищённая серверная точка для будущего real football API
services/pattern-engine.js
                pressure score, оценка матчей и создание сигналов
services/signal-result-engine.js
                проверка результата сигнала по событиям матча
src/services/patternEngine/
                TypeScript-структура Pattern Engine для будущей сборки
src/services/footballDataProvider/
                TypeScript-контракт данных и mock/real providers для будущего API
src/services/journalStorage/
                контракт постоянного журнала, Supabase-адаптер и Edge Function client
src/services/storage/
                ключи локального хранилища для будущей модульной сборки
src/types/
                доменные типы матчей, статистики, сигналов, паттернов, пользователей и feedback
services/telegram-service.js
                Telegram-заглушка без внешней отправки
services/formatters.js
                форматирование дат, статусов, результатов и безопасный вывод текста
services/storage.js
                чтение и запись настроек, журнала, профилей условий и заметок в localStorage
services/history-service.js
                фильтры журнала, статистика Win/Lose, периоды и экспорт истории
services/pattern-analytics-service.js
                эффективность паттернов, статусы, качество, слабые профили и группировки
services/team-profile-service.js
                сбор профиля команды, заметки, журнал заметок и команды с наблюдениями
services/settings-service.js
                обновление настроек и отображение статуса Telegram-заглушки
services/social-feedback-service.js
                сводка профиля, социального доверия и раздела Ideas / Feedback
manifest.webmanifest
sw.js
icons/live-scanner-icon-*.png
icons/live-scanner-logo.png
supabase/migrations/001_journal_storage.sql
                минимальная схема Supabase только для журнала и статистики паттернов
supabase/functions/journal-ingest/
                Edge Function для безопасной записи журнала через service-role secret
supabase/functions/journal-read/
                Edge Function для безопасного чтения журнала и агрегатов
```

## React + TypeScript

React-версия стала основной оболочкой проекта и открывается через корневой `index.html`.

Основной код лежит здесь:

```text
src/react/
```

После установки зависимостей можно запустить React-версию:

```powershell
npm run dev:react
```

И открыть:

```text
http://127.0.0.1:5173/react/
```

React-версия использует существующие mock-данные из `data/mock-data.js` и TypeScript Pattern Engine из `src/services/patternEngine/`.

В React-слое уже перенесены:

- `Сканер матчей`.
- `Найденные сигналы`.
- `Паттерны`.
- `История`.
- `Аналитика`.
- Профиль команды при клике на команду.
- `Настройки`.
- `Профиль`.
- `Идеи`.
- Навигация между React-разделами.

GitHub Pages публикует production-сборку React из `dist-react` через workflow `.github/workflows/pages.yml`.

Pattern Engine вынесен в `services/pattern-engine.js`:

- `calculatePressureScore(stats)`
- `getSignalStrength(score)`
- `getPatternStatus(patternType)`
- `evaluateAllMatches()`
- `evaluateMatch(match, snapshot, patterns)`
- `evaluatePattern(match, snapshot, pattern, side)`

Для будущего перехода на TypeScript добавлена структура:

```text
src/services/patternEngine/calculatePressureScore.ts
src/services/patternEngine/getSignalStrength.ts
src/services/patternEngine/evaluatePattern.ts
src/services/patternEngine/evaluateMatch.ts
src/services/patternEngine/getPatternStatus.ts
```

Внутри `app.js` остались экранная логика, журнал событий и расчёт Win/Lose.

## Модульная структура

Проект переведен на модульную структуру React + TypeScript:

```text
src/types/
                общие типы домена
src/services/footballDataProvider/
                асинхронный контракт данных, MockFootballProvider и RealFootballProvider
src/services/journalStorage/
                постоянный журнал сигналов без хранения тяжелого live-потока
src/services/patternEngine/
                TypeScript-версия расчетов Pattern Engine
src/services/storage/
                единые ключи localStorage
src/index.ts
                общая точка экспорта будущего приложения
```

## Журнал сигналов

Каждое событие хранит:

```text
id, matchId, patternId, teamId, teamSide,
minute, scoreHome, scoreAway,
pressureScore, strength,
statsAtSignal,
createdAt, updatedAt,
result.goalWithin5, result.goalWithin10, result.goalWithin15,
result.goalMinute, result.goalTeam, result.finalComment
```

## Pattern Analytics

Статусы считаются по MVP-логике:

```text
сигналов < 30 -> new
30-99 и successRate15 >= 35% -> promising
>= 100 и successRate15 >= 35% -> working
>= 100 и successRate15 >= 20% и < 35% -> weak
>= 100 и successRate15 < 20% -> ineffective
ручное изменение -> testing
```

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

В текущем MVP используется mock mode. Слой данных уже вынесен в единый контракт:

```ts
interface FootballDataProvider {
  getLiveMatches(): Promise<Match[]>;
  getMatchStats(matchId: string): Promise<MatchStatsSnapshot>;
  getMatchEvents?(matchId: string): Promise<any[]>;
  getPatterns(): Promise<Pattern[]>;
  getTeamProfile(teamId: string): Promise<TeamProfile | null>;
  getTeamRecentMatches(teamId: string): Promise<TeamMatch[]>;
  getUserProfile(): Promise<UserProfile | null>;
  getFeedbackItems(): Promise<FeedbackItem[]>;
}
```

Текущая реализация уже вынесена в:

```text
services/football-provider.js
```

Доступные реализации:

```text
MockFootballProvider
RealFootballProvider
```

`RealFootballProvider` пока возвращает пустые значения и оставлен как точка подключения будущего football API.

## Telegram-заглушка

Файл `services/telegram-service.js` содержит:

```text
sendTelegramTestMessage(settings)
sendSignalToTelegram(signal, settings)
buildSignalMessage(signal)
```

Сервис пока работает в mock-режиме: готовит текст аналитического уведомления и возвращает статус без внешней отправки.

## Пользователи и Ideas / Feedback

Задачи 9-10 подготовлены на mock-данных:

- `userProfile` хранит личный профиль, будущий публичный профиль, права доступа и social trust.
- `feedbackItems` хранит идеи, feedback, приоритет, статус, количество голосов и дату создания.
- Кнопка `Профиль` в верхней панели открывает раздел профиля.
- Раздел `Идеи` показывает roadmap/feedback без подключения сервера.

## Env на будущее

```text
DATA_MODE=mock
FOOTBALL_API_PROVIDER=mock
FOOTBALL_API_KEY=server-only
TELEGRAM_BOT_TOKEN=server-only
JOURNAL_ACCESS_TOKEN=server-only
```

Секреты не должны начинаться с `VITE_`, если они не предназначены для браузера. Все ключи поставщиков данных, Telegram bot token и service-role ключи хранятся только на backend/Edge Functions.
