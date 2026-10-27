-- Pulse: scheduled jobs (pg_cron). cron.schedule() with an existing name
-- replaces that job, so this migration is safe to re-run.

select cron.schedule('pulse-refresh-live-cells', '* * * * *', 'select public.refresh_live_cells()');
select cron.schedule('pulse-purge-expired-pings', '* * * * *', 'select public.purge_expired_pings()');
select cron.schedule('pulse-snapshot-hourly', '*/15 * * * *', 'select public.snapshot_hourly()');
select cron.schedule('pulse-purge-retention', '17 * * * *', 'select public.purge_retention()');
