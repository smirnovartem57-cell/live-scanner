# Live Scanner Supabase storage

Храним в Supabase только постоянные данные журнала:

- `journal_signals` — найденные сигналы.
- `journal_signal_results` — результат сигнала и ручное закрытие.
- `pattern_stats_daily` — дневная статистика паттернов.
- `journal_ingestion_runs` — служебный лог запусков синхронизации.

Сырые live-снимки матчей пока не сохраняем постоянно. Они нужны только для текущего расчета Pattern Engine. Это снижает объем базы и стоимость.

## Как применить

1. Создать Supabase project.
2. Открыть SQL Editor.
3. Выполнить `migrations/001_journal_storage.sql`.
4. Развернуть Edge Functions `journal-ingest`, `journal-read` и `football-live`.
5. Добавить secrets `SUPABASE_SERVICE_ROLE_KEY`, `JOURNAL_ACCESS_TOKEN` и при необходимости `FOOTBALL_DATA_ACCESS_TOKEN` в Supabase Functions.
6. Когда появятся логины, добавить политики чтения для authenticated users.

## Переменные

Для Edge Function:

```text
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
JOURNAL_ACCESS_TOKEN=long-random-private-token
FOOTBALL_DATA_ACCESS_TOKEN=optional-long-random-private-token
```

`SUPABASE_SERVICE_ROLE_KEY` нельзя добавлять в GitHub Pages или frontend env.
`JOURNAL_ACCESS_TOKEN` обязателен для закрытого личного доступа к чтению и записи журнала. Если secret не задан или в приложении указан другой токен, `journal-read` и `journal-ingest` вернут `403`.
`football-live` использует `FOOTBALL_DATA_ACCESS_TOKEN`, а если он не задан, проверяет `JOURNAL_ACCESS_TOKEN`.

## Следующий шаг

Развернуть Edge Functions `journal-ingest`, `journal-read` и `football-live`.

Функция принимает:

- `events` — события журнала;
- `patternStats` — дневные агрегаты паттернов;
- `ingestionRun` — служебный лог синхронизации.

В браузере используется anon key и личный `Journal access token`. Service-role ключ хранится только в Supabase secrets функции.

`football-live` пока возвращает пустой live-snapshot и служит защищённым местом для будущего football API. Ключ поставщика данных должен храниться только внутри этой функции.

После этого можно заменить mock-историю на чтение из `journal_signals + journal_signal_results`.

`journal-read` возвращает последние события журнала и, при необходимости, дневные агрегаты `pattern_stats_daily`.

## Проверка из интерфейса

В разделе `Настройки` включить `Запись в Supabase`, указать `Supabase URL` и `anon key`, затем нажать `Проверить запись журнала`.

Кнопка отправляет последние события текущей истории и дневные агрегаты паттернов в Edge Function `journal-ingest`.
