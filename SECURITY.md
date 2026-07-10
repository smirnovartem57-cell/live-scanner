# Live Scanner security notes

## Current public mode

GitHub Pages is intentionally locked down to `public-closed`.

The published domain must not serve:

- the React application;
- `data/mock-data.js`;
- Supabase settings;
- Edge Function secrets;
- football API keys;
- Telegram bot tokens.

## Required manual settings

For full protection:

1. Keep GitHub Pages disabled or pointed only to the closed artifact.
2. Make the repository private before adding real provider code or real datasets.
3. Store Supabase service-role key only in Supabase Edge Function secrets.
4. Set `JOURNAL_ACCESS_TOKEN` in Supabase Edge Function secrets.
5. Set `FOOTBALL_DATA_ACCESS_TOKEN` for `football-live`, or let it reuse `JOURNAL_ACCESS_TOKEN`.
6. Use the same access token in the closed local/private app settings.

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
- football data provider keys;
- Telegram bot token.
