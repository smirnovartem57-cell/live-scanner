# Live Scanner

Закрытое React + TypeScript PWA для анализа live-статистики футбольных матчей, поиска игровых паттернов и ведения журнала сигналов.

Production: https://live-scanner.smirart.ru/

## Возможности

- real-time данные через защищённую Supabase Edge Function и API-FOOTBALL;
- шесть серверных и браузерных паттернов с единым Pattern Engine;
- постоянный журнал сигналов, автоматическое и ручное закрытие результатов;
- серверный фоновый сканер;
- Telegram-уведомления с атомарной защитой от дублей;
- общий кэш, блокировка параллельных обновлений и защита дневной квоты;
- безопасное автообновление открытого интерфейса;
- необязательная авторизация пользователей через Supabase Auth;
- диагностика секретов, миграций, кэша, сканера и Telegram без расхода API-квоты;
- mock-режим для разработки без внешних запросов;
- PWA, мобильная навигация и GitHub Pages deployment.

## Локальный запуск

Требуется Node.js 20+.

```powershell
npm install
npm run dev:react
```

Открыть `http://127.0.0.1:5173/`.

Проверка перед публикацией:

```powershell
npm run typecheck
npm test
npm run build:react
```

## Структура

```text
src/react/                         интерфейс, настройки и React hooks
src/services/patternEngine/        единый Pattern Engine
src/services/apiFootball/          нормализация и политика квоты
src/services/footballDataProvider/ mock/real источники данных
src/services/journalStorage/       клиенты постоянного журнала
supabase/functions/                Edge Functions
supabase/migrations/               SQL-миграции 001–006
data/mock-data.js                  данные демо-режима
```

## Настройка Supabase

В SQL Editor последовательно выполнить:

1. `001_journal_storage.sql`
2. `002_social_data.sql`
3. `003_live_scan_cron.sql`
4. `004_football_live_cache.sql`
5. `005_telegram_delivery_dedupe.sql`
6. `006_social_data_service_role.sql`

Развернуть функции:

```powershell
supabase functions deploy football-live --no-verify-jwt
supabase functions deploy journal-ingest --no-verify-jwt
supabase functions deploy journal-read --no-verify-jwt
supabase functions deploy telegram-send --no-verify-jwt
supabase functions deploy social-data --no-verify-jwt
supabase functions deploy live-scan --no-verify-jwt
supabase functions deploy system-health --no-verify-jwt
```

Обязательные secrets:

```text
JOURNAL_ACCESS_TOKEN
FOOTBALL_DATA_ACCESS_TOKEN
TELEGRAM_ACCESS_TOKEN
SOCIAL_DATA_ACCESS_TOKEN
API_FOOTBALL_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHANNEL
```

Если отдельные access tokens не заданы, функции используют `JOURNAL_ACCESS_TOKEN`. Значения токенов и ключ API нельзя сохранять в Git.

Без дополнительных настроек `football-live` использует безопасный профиль Free:

- кэш 45 минут;
- подробные данные максимум для одного матча;
- резерв 5 запросов;
- максимум 9 API-запросов на один принудительный refresh даже при изменённой конфигурации.

Фоновое расписание намеренно не включается миграцией. Инструкции по Vault и Cron находятся в [supabase/README.md](supabase/README.md).

## Публикация

Push в `main` запускает `.github/workflows/pages.yml`: typecheck, тесты, production-сборку и публикацию GitHub Pages. Секреты API находятся только в Supabase Edge Functions.

## Безопасность

Публичный publishable key Supabase допустим во frontend. Service-role key, API-FOOTBALL key, Telegram bot token и личные access tokens должны оставаться только в Supabase или локальных настройках пользователя. Подробности и порядок сообщения об уязвимостях — в [SECURITY.md](SECURITY.md).
