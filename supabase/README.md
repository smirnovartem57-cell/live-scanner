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
4. Развернуть Edge Function `journal-ingest`.
5. Добавить secret `SUPABASE_SERVICE_ROLE_KEY` в Supabase Functions.
6. Когда появятся логины, добавить политики чтения для authenticated users.

## Переменные

Для сайта:

```text
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Для Edge Function:

```text
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` нельзя добавлять в GitHub Pages или frontend env.

## Следующий шаг

Развернуть Edge Function `journal-ingest`.

Функция принимает:

- `events` — события журнала;
- `patternStats` — дневные агрегаты паттернов;
- `ingestionRun` — служебный лог синхронизации.

В браузере используется только anon key. Service-role ключ хранится только в Supabase secrets функции.

После этого можно заменить mock-историю на чтение из `journal_signals + journal_signal_results`.

## Проверка из интерфейса

В разделе `Настройки` включить `Запись в Supabase`, указать `Supabase URL` и `anon key`, затем нажать `Проверить запись журнала`.

Кнопка отправляет последние события текущей истории и дневные агрегаты паттернов в Edge Function `journal-ingest`.
