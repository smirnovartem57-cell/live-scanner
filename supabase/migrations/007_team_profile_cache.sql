-- Long-lived cache for user-requested team profiles.
-- Team history and season aggregates change slowly and must not consume the
-- API-FOOTBALL Free quota every time a profile is opened.

create table if not exists public.team_profile_cache (
  cache_key text primary key,
  team_id text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default to_timestamp(0),
  refresh_locked_until timestamptz not null default to_timestamp(0),
  daily_limit integer,
  daily_remaining integer,
  api_requests_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_profile_cache enable row level security;

create or replace function public.claim_team_profile_refresh(
  requested_cache_key text,
  requested_team_id text,
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
  insert into public.team_profile_cache (cache_key, team_id)
  values (requested_cache_key, requested_team_id)
  on conflict (cache_key) do nothing;

  update public.team_profile_cache
  set refresh_locked_until = now() + make_interval(secs => greatest(30, least(lock_seconds, 300))),
      updated_at = now()
  where cache_key = requested_cache_key
    and expires_at <= now()
    and refresh_locked_until <= now();

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.claim_team_profile_refresh(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_team_profile_refresh(text, text, integer)
  to service_role;
grant select, insert, update on table public.team_profile_cache to service_role;

create index if not exists idx_team_profile_cache_team_updated
  on public.team_profile_cache(team_id, updated_at desc);
