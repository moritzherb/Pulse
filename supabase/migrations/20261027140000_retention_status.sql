-- Pulse: operational check that retention is actually happening.
--
--   select public.retention_status();   -- SQL editor / service role only
--
-- Returns the age of the oldest raw ping (should stay under ~21 minutes),
-- anonymous identities past 25 hours (should be 0 shortly after :17 each
-- hour), the oldest history row (should stay under 12 months) and the last
-- run of every Pulse cron job.
create or replace function public.retention_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'checked_at', now(),
    'pings', (select count(*) from public.pings),
    'oldest_ping_minutes',
      (select round((extract(epoch from now() - min(created_at)) / 60)::numeric, 1) from public.pings),
    'live_cells', (select count(*) from public.live_cells),
    'anonymous_users', (select count(*) from auth.users where is_anonymous),
    'anonymous_users_over_25h',
      (select count(*) from auth.users where is_anonymous and created_at < now() - interval '25 hours'),
    'oldest_history_days',
      (select round((extract(epoch from now() - min(hour_start)) / 86400)::numeric, 1) from public.cell_hourly),
    'jobs', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'job', j.jobname,
               'schedule', j.schedule,
               'active', j.active,
               'last_status', r.status,
               'last_run', r.end_time
             ) order by j.jobname), '[]'::jsonb)
      from cron.job j
      left join lateral (
        select d.status, d.end_time
        from cron.job_run_details d
        where d.jobid = j.jobid
        order by d.start_time desc
        limit 1
      ) r on true
      where j.jobname like 'pulse-%'
    )
  )
$$;

revoke all on function public.retention_status() from public, anon, authenticated;
grant execute on function public.retention_status() to service_role;
