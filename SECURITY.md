# Live Scanner security notes

## Current public mode

GitHub Pages serves the React application on the public domain.

The public app may include UI code, static assets and mock/demo data. Real journal data and real football API data must stay behind Supabase Edge Functions with access-token checks.

The published domain must not serve:

- Supabase service-role keys;
- Edge Function secrets;
- football API keys;
- Telegram bot tokens;
- private real datasets.

## Required manual settings

For full protection:

1. Keep real data access routed through Supabase Edge Functions.
2. Make the repository private before adding private datasets or provider code that should not be public.
3. Store Supabase service-role key only in Supabase Edge Function secrets.
4. Set `JOURNAL_ACCESS_TOKEN` in Supabase Edge Function secrets.
5. Set `FOOTBALL_DATA_ACCESS_TOKEN` for `football-live`, or let it reuse `JOURNAL_ACCESS_TOKEN`.
6. Use the same access token in the app settings when real data mode is enabled.

If `JOURNAL_ACCESS_TOKEN` is missing or incorrect, `journal-read` and `journal-ingest` return `403`.

## Frontend rule

Do not add private values to `VITE_*` variables.

Anything exposed through `VITE_*`, JavaScript bundles, local HTML, or GitHub Pages can be read by the browser.

Safe for frontend:

- Supabase anon key;
- public project URL;
- display-only settings.

Backend/Edge Function only:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `JOURNAL_ACCESS_TOKEN`;
- `FOOTBALL_DATA_ACCESS_TOKEN`;
- `API_FOOTBALL_KEY`;
- football data provider keys;
- Telegram bot token.
