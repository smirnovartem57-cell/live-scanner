# Live Scanner Supabase storage

Храним в Supabase только постоянные данные журнала:

- `journal_signals` — найденные сигналы.
- `journal_signal_results` — результат сигнала и ручное закрытие.
- `pattern_stats_daily` — дневная статистика паттернов.
- `journal_ingestion_runs` — служебный лог запусков синхронизации.
- `app_profiles` — закрытый профиль пользователя и настройки социального доверия.
- `feedback_items` — идеи, обратная связь, приоритеты, статусы и голоса.

Сырые live-снимки матчей пока не сохраняем постоянно. Они нужны только для текущего расчета Pattern Engine. Это снижает объем базы и стоимость.

## Как применить

1. Создать Supabase project.
2. Открыть SQL Editor.
3. Выполнить по порядку `migrations/001_journal_storage.sql` и `migrations/002_social_data.sql`.
4. Развернуть Edge Functions `journal-ingest`, `journal-read`, `football-live`, `telegram-send` и `social-data`.
5. Добавить secrets `SUPABASE_SERVICE_ROLE_KEY`, `JOURNAL_ACCESS_TOKEN`, `API_FOOTBALL_KEY`, `TELEGRAM_BOT_TOKEN` и при необходимости отдельные `FOOTBALL_DATA_ACCESS_TOKEN`, `TELEGRAM_ACCESS_TOKEN` и `SOCIAL_DATA_ACCESS_TOKEN` в Supabase Functions.
6. Когда появятся логины, добавить политики чтения для authenticated users.

## Переменные

Для Edge Function:

```text
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
JOURNAL_ACCESS_TOKEN=long-random-private-token
FOOTBALL_DATA_ACCESS_TOKEN=optional-long-random-private-token
API_FOOTBALL_KEY=server-only-api-football-key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_CACHE_TTL_SECONDS=45
API_FOOTBALL_MAX_FIXTURES=30
TELEGRAM_BOT_TOKEN=server-only-telegram-bot-token
TELEGRAM_ACCESS_TOKEN=optional-long-random-private-token
SOCIAL_DATA_ACCESS_TOKEN=optional-long-random-private-token
```

`SUPABASE_SERVICE_ROLE_KEY` нельзя добавлять в GitHub Pages или frontend env.
`JOURNAL_ACCESS_TOKEN` обязателен для закрытого личного доступа к чтению и записи журнала. Если secret не задан или в приложении указан другой токен, `journal-read` и `journal-ingest` вернут `403`.
`football-live` использует `FOOTBALL_DATA_ACCESS_TOKEN`, а если он не задан, проверяет `JOURNAL_ACCESS_TOKEN`.
`API_FOOTBALL_KEY` используется только внутри `football-live` и не должен попадать в браузер.
`API_FOOTBALL_CACHE_TTL_SECONDS` защищает квоту API от частых обновлений, а `API_FOOTBALL_MAX_FIXTURES` ограничивает количество live-матчей, для которых подтягиваются подробные statistics/events.
`telegram-send` использует `TELEGRAM_ACCESS_TOKEN`, а если он не задан — `JOURNAL_ACCESS_TOKEN`. Токен бота хранится только в секрете `TELEGRAM_BOT_TOKEN` и никогда не передаётся в браузер.
`social-data` читает и обновляет профиль и идеи через service-role доступ. Функция использует `SOCIAL_DATA_ACCESS_TOKEN`, а если он не задан — `JOURNAL_ACCESS_TOKEN`. Таблицы закрыты RLS и напрямую из браузера не читаются.

## Следующий шаг

Развернуть Edge Functions `journal-ingest`, `journal-read` и `football-live`.

Функция принимает:

- `events` — события журнала;
- `patternStats` — дневные агрегаты паттернов;
- `ingestionRun` — служебный лог синхронизации.

В браузере используется anon key и личный `Journal access token`. Service-role ключ хранится только в Supabase secrets функции.

`football-live` читает live fixtures, statistics и events из API-FOOTBALL/API-SPORTS и нормализует их в типы Live Scanner. Если `API_FOOTBALL_KEY` не задан, функция возвращает пустой snapshot без ошибки.

После этого можно заменить mock-историю на чтение из `journal_signals + journal_signal_results`.

`journal-read` возвращает последние события журнала и, при необходимости, дневные агрегаты `pattern_stats_daily`.

## Проверка из интерфейса

В разделе `Настройки` включить `Запись в Supabase`, указать `Supabase URL` и `anon key`, затем нажать `Проверить запись журнала`.

Кнопка отправляет последние события текущей истории и дневные агрегаты паттернов в Edge Function `journal-ingest`.
