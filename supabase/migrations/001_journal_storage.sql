-- Live Scanner journal-only persistent storage.
-- This schema stores only signals, their results, and pattern aggregates.
-- Raw live-stat snapshots stay temporary until volume justifies time-series storage.

create extension if not exists pgcrypto;

create table if not exists public.journal_signals (
  id text primary key,
  dedupe_key text not null unique,
  match_id text not null,
  match_name text not null,
  league text not null,
  pattern_id text not null,
  pattern_type text not null,
  team_id text,
  team_side text not null check (team_side in ('home', 'away')),
  minute integer not null,
  score_home integer not null,
  score_away integer not null,
  score text not null,
  pressure_score integer not null check (pressure_score >= 0 and pressure_score <= 100),
  strength text not null check (strength in ('LOW', 'MED', 'HIGH')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'success', 'failed')),
  signal_kind text not null default 'signal' check (signal_kind in ('signal', 'warning')),
  stats_at_signal jsonb not null default '{}'::jsonb,
  explanation text not null default '',
  comment text not null default '',
  source text not null default 'pattern_engine',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_signal_results (
  signal_id text primary key references public.journal_signals(id) on delete cascade,
  goal_within_5 boolean not null default false,
  goal_within_10 boolean not null default false,
  goal_within_15 boolean not null default false,
  goal_minute integer,
  goal_team text check (goal_team in ('home', 'away')),
  manual_outcome text check (manual_outcome in ('win', 'lose')),
  final_comment text not null default '',
  result_source text not null default 'auto' check (result_source in ('auto', 'manual', 'seed')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pattern_stats_daily (
  stat_date date not null,
  pattern_id text not null,
  pattern_type text not null,
  total_signals integer not null default 0,
  success_within_5 integer not null default 0,
  success_within_10 integer not null default 0,
  success_within_15 integer not null default 0,
  failed_signals integer not null default 0,
  warning_signals integer not null default 0,
  average_pressure_score numeric(6,2) not null default 0,
  average_minute numeric(6,2) not null default 0,
  quality_score integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (stat_date, pattern_id)
);

create table if not exists public.journal_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null check (status in ('started', 'success', 'failed')),
  matches_seen integer not null default 0,
  signals_created integer not null default 0,
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_journal_signals_created_at on public.journal_signals(created_at desc);
create index if not exists idx_journal_signals_pattern_created on public.journal_signals(pattern_id, created_at desc);
create index if not exists idx_journal_signals_match_pattern_side on public.journal_signals(match_id, pattern_id, team_side);
create index if not exists idx_journal_signal_results_closed_at on public.journal_signal_results(closed_at desc);
create index if not exists idx_pattern_stats_daily_pattern_date on public.pattern_stats_daily(pattern_id, stat_date desc);

alter table public.journal_signals enable row level security;
alter table public.journal_signal_results enable row level security;
alter table public.pattern_stats_daily enable row level security;
alter table public.journal_ingestion_runs enable row level security;

-- Closed MVP note:
-- Use a backend/Edge Function with the service-role key for writes.
-- Add authenticated read policies when login is enabled.
