create table if not exists public.app_profiles (
  id text primary key,
  display_name text not null,
  handle text not null unique,
  role text not null default 'analyst',
  access_level text not null default 'private',
  joined_at timestamptz not null default now(),
  public_profile_ready boolean not null default false,
  avatar text not null default '',
  bio text not null default '',
  social_trust jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  future_fields jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback_items (
  id text primary key,
  type text not null check (type in ('idea', 'feedback')),
  title text not null,
  description text not null default '',
  status text not null check (status in ('planned', 'in_review', 'next')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  votes integer not null default 0 check (votes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.increment_feedback_votes(item_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare next_votes integer;
begin
  update feedback_items set votes = votes + 1, updated_at = now()
  where id = item_id returning votes into next_votes;
  if next_votes is null then raise exception 'Feedback item not found'; end if;
  return next_votes;
end;
$$;

revoke all on function public.increment_feedback_votes(text) from public, anon, authenticated;
alter table public.app_profiles enable row level security;
alter table public.feedback_items enable row level security;
create index if not exists idx_feedback_items_status_priority on public.feedback_items(status, priority, created_at desc);
