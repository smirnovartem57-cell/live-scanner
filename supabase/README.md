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
4. Записи делать только через backend/Edge Function с service-role ключом.
5. Когда появятся логины, добавить политики чтения для authenticated users.

## Следующий шаг

Подключить Supabase client и заменить mock-историю на чтение из `journal_signals + journal_signal_results`.
