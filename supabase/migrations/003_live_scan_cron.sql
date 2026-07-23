-- Server-side Live Scanner scheduler.
-- The job is intentionally not enabled by this migration: API-FOOTBALL Free
-- has a small daily quota, so the schedule must be selected explicitly.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_live_scanner()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  publishable_key text;
  access_token text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'live_scanner_project_url'
  limit 1;

  select decrypted_secret into publishable_key
  from vault.decrypted_secrets
  where name = 'live_scanner_publishable_key'
  limit 1;

  select decrypted_secret into access_token
  from vault.decrypted_secrets
  where name = 'live_scanner_access_token'
  limit 1;

  if project_url is null or publishable_key is null or access_token is null then
    raise exception 'Live Scanner Vault secrets are not configured';
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/live-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', publishable_key,
      'x-live-scanner-key', access_token
    ),
    body := jsonb_build_object('scope', 'scheduled-scan', 'requestedAt', now()),
    timeout_milliseconds := 120000
  ) into request_id;

  return request_id;
end;
$$;

create or replace function public.enable_live_scanner_cron(job_schedule text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_job_id bigint;
  new_job_id bigint;
begin
  if job_schedule is null or btrim(job_schedule) = '' then
    raise exception 'A cron schedule is required';
  end if;

  select jobid into existing_job_id
  from cron.job
  where jobname = 'live-scanner-background'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  select cron.schedule(
    'live-scanner-background',
    job_schedule,
    'select public.invoke_live_scanner();'
  ) into new_job_id;

  return new_job_id;
end;
$$;

create or replace function public.disable_live_scanner_cron()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'live-scanner-background'
  limit 1;

  if existing_job_id is null then
    return false;
  end if;

  return cron.unschedule(existing_job_id);
end;
$$;

revoke all on function public.invoke_live_scanner() from public, anon, authenticated;
revoke all on function public.enable_live_scanner_cron(text) from public, anon, authenticated;
revoke all on function public.disable_live_scanner_cron() from public, anon, authenticated;

comment on function public.invoke_live_scanner() is
  'Invokes the protected live-scan Edge Function using credentials stored in Vault.';
comment on function public.enable_live_scanner_cron(text) is
  'Enables or replaces the live-scanner-background Cron job. Choose the schedule according to the API plan.';
comment on function public.disable_live_scanner_cron() is
  'Disables the live-scanner-background Cron job.';
