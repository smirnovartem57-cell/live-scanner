-- Shared cache and refresh lock for API-FOOTBALL.
-- This prevents browser refreshes and Cron invocations from multiplying
-- provider requests across separate Edge Function isolates.

create table if not exists public.football_live_cache (
  cache_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  provider text not null default 'api-football',
  message text not null default '',
  api_requests_used integer not null default 0,
  daily_limit integer,
  daily_remaining integer,
  minute_limit integer,
  minute_remaining integer,
  expires_at timestamptz not null default to_timestamp(0),
  refresh_locked_until timestamptz not null default to_timestamp(0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.football_live_cache (cache_key)
values ('live-snapshot')
on conflict (cache_key) do nothing;

alter table public.football_live_cache enable row level security;

create or replace function public.claim_football_live_refresh(
  requested_cache_key text,
  lock_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  insert into public.football_live_cache (cache_key)
  values (requested_cache_key)
  on conflict (cache_key) do nothing;

  update public.football_live_cache
  set refresh_locked_until = now() + make_interval(secs => greatest(30, least(lock_seconds, 300))),
      updated_at = now()
  where cache_key = requested_cache_key
    and expires_at <= now()
    and refresh_locked_until <= now();

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.claim_football_live_refresh(text, integer) from public, anon, authenticated;

create index if not exists idx_football_live_cache_expires
  on public.football_live_cache(expires_at);

comment on table public.football_live_cache is
  'Shared API-FOOTBALL snapshot cache, quota telemetry, and refresh lock.';
