-- Atomic Telegram delivery deduplication shared by browser and Cron senders.

create table if not exists public.telegram_signal_deliveries (
  signal_id text not null,
  channel text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 0,
  locked_until timestamptz not null default to_timestamp(0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (signal_id, channel)
);

alter table public.telegram_signal_deliveries enable row level security;

create or replace function public.claim_telegram_signal_delivery(
  requested_signal_id text,
  requested_channel text,
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
  insert into public.telegram_signal_deliveries (
    signal_id,
    channel,
    status,
    attempt_count,
    locked_until
  )
  values (
    requested_signal_id,
    requested_channel,
    'failed',
    0,
    to_timestamp(0)
  )
  on conflict (signal_id, channel) do nothing;

  update public.telegram_signal_deliveries
  set status = 'pending',
      attempt_count = attempt_count + 1,
      locked_until = now() + make_interval(secs => greatest(30, least(lock_seconds, 300))),
      last_error = null,
      updated_at = now()
  where signal_id = requested_signal_id
    and channel = requested_channel
    and status <> 'sent'
    and locked_until <= now();

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.claim_telegram_signal_delivery(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_telegram_signal_delivery(text, text, integer)
  to service_role;
grant select, insert, update on table public.telegram_signal_deliveries
  to service_role;

create index if not exists idx_telegram_signal_deliveries_status
  on public.telegram_signal_deliveries(status, updated_at desc);

comment on table public.telegram_signal_deliveries is
  'Atomic delivery state that prevents duplicate Telegram messages across devices and workers.';
