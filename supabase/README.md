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
3. Выполнить по порядку миграции `001`–`005`.
4. Развернуть Edge Functions `journal-ingest`, `journal-read`, `football-live`, `telegram-send`, `social-data`, `live-scan` и `system-health`.
5. Добавить secrets `SUPABASE_SERVICE_ROLE_KEY`, `JOURNAL_ACCESS_TOKEN`, `API_FOOTBALL_KEY`, `TELEGRAM_BOT_TOKEN` и при необходимости отдельные `FOOTBALL_DATA_ACCESS_TOKEN`, `TELEGRAM_ACCESS_TOKEN` и `SOCIAL_DATA_ACCESS_TOKEN` в Supabase Functions.
6. Для будущего разделения данных между несколькими пользователями добавить `user_id` и отдельные authenticated RLS policies; текущие таблицы доступны только Edge Functions через service-role.

## Переменные

Для Edge Function:

```text
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
JOURNAL_ACCESS_TOKEN=long-random-private-token
FOOTBALL_DATA_ACCESS_TOKEN=optional-long-random-private-token
API_FOOTBALL_KEY=server-only-api-football-key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_CACHE_TTL_SECONDS=2700
API_FOOTBALL_MAX_FIXTURES=1
API_FOOTBALL_DAILY_RESERVE=5
TELEGRAM_BOT_TOKEN=server-only-telegram-bot-token
TELEGRAM_ACCESS_TOKEN=optional-long-random-private-token
SOCIAL_DATA_ACCESS_TOKEN=optional-long-random-private-token
LIVE_SCAN_ACCESS_TOKEN=optional-long-random-private-token
SYSTEM_HEALTH_ACCESS_TOKEN=optional-long-random-private-token
TELEGRAM_CHANNEL=@channel-or-chat-id
```

`SUPABASE_SERVICE_ROLE_KEY` нельзя добавлять в GitHub Pages или frontend env.
`JOURNAL_ACCESS_TOKEN` обязателен для закрытого личного доступа к чтению и записи журнала. Если secret не задан или в приложении указан другой токен, `journal-read` и `journal-ingest` вернут `403`.
`football-live` использует `FOOTBALL_DATA_ACCESS_TOKEN`, а если он не задан, проверяет `JOURNAL_ACCESS_TOKEN`.
`API_FOOTBALL_KEY` используется только внутри `football-live` и не должен попадать в браузер.
`API_FOOTBALL_CACHE_TTL_SECONDS` защищает квоту API от частых обновлений, `API_FOOTBALL_MAX_FIXTURES` ограничивает количество live-матчей, для которых подтягиваются подробные statistics/events, а `API_FOOTBALL_DAILY_RESERVE` прекращает обновления до полного исчерпания дневного лимита.
Без дополнительных secrets используются безопасные настройки Free: общий кэш на 45 минут, не более одного подробного матча и резерв 5 запросов. Для Pro можно уменьшить TTL и увеличить число матчей, но не выше четырёх за один запуск.
`telegram-send` использует `TELEGRAM_ACCESS_TOKEN`, а если он не задан — `JOURNAL_ACCESS_TOKEN`. Токен бота хранится только в секрете `TELEGRAM_BOT_TOKEN` и никогда не передаётся в браузер.
`social-data` читает и обновляет профиль и идеи через service-role доступ. Функция использует `SOCIAL_DATA_ACCESS_TOKEN`, а если он не задан — `JOURNAL_ACCESS_TOKEN`. Таблицы закрыты RLS и напрямую из браузера не читаются.
`live-scan` запускает тот же Pattern Engine на сервере, записывает новые сигналы и результаты в журнал и отправляет новые сигналы в `TELEGRAM_CHANNEL`. Для защиты используется `LIVE_SCAN_ACCESS_TOKEN`, а если он не задан — `JOURNAL_ACCESS_TOKEN`.
`system-health` проверяет серверную конфигурацию, наличие миграций, состояние общего кэша, последний запуск сканера и Telegram-доставку. Функция не обращается к API-FOOTBALL и поэтому не расходует его квоту.

## Фоновый сканер

Миграция `003_live_scan_cron.sql` добавляет защищённый вызов `live-scan` через Supabase Cron и pg_net. Расписание намеренно не включается автоматически. Миграция `004_football_live_cache.sql` добавляет общий для всех Edge Function isolates кэш, блокировку параллельного обновления и телеметрию оставшейся квоты API.
Миграция `005_telegram_delivery_dedupe.sql` добавляет атомарный журнал Telegram-доставки. Повторный вызов для той же пары «сигнал + канал» не создаёт второе сообщение, независимо от устройства или источника запуска.

Перед включением добавьте в Supabase Vault три секрета:

```sql
select vault.create_secret('https://PROJECT.supabase.co', 'live_scanner_project_url');
select vault.create_secret('YOUR_PUBLISHABLE_KEY', 'live_scanner_publishable_key');
select vault.create_secret('YOUR_PRIVATE_ACCESS_TOKEN', 'live_scanner_access_token');
```

Включение и выключение выполняется из SQL Editor:

```sql
select public.enable_live_scanner_cron('*/2 * * * *');
select public.disable_live_scanner_cron();
```

Интервал `*/2 * * * *` рассчитан на платный API-FOOTBALL Pro при дополнительном ограничении числа матчей. На Free плане автоматический частый запуск включать нельзя: доступно только 100 запросов в сутки и 10 запросов в минуту.

## Формат журнала

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
