-- Pulse: also expire Supabase Auth's audit log.
--
-- Every anonymous sign-in writes a row to auth.audit_log_entries that
-- includes the caller's IP address. Pulse never reads it, so it is kept no
-- longer than the identities it describes (25 h). If the project does not
-- allow this role to touch the auth schema, or the table does not exist
-- (audit logging disabled), the step is skipped and the rest of the job runs.
create or replace function public.purge_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users u
  where u.is_anonymous and u.created_at < now() - interval '25 hours';

  delete from public.cell_hourly where hour_start < now() - interval '12 months';
  delete from public.snapshot_runs where hour_start < now() - interval '12 months';

  delete from public.cells c
  where c.first_seen < now() - interval '25 hours'
    and not exists (select 1 from public.pings p where p.cell = c.cell)
    and not exists (select 1 from public.live_cells l where l.cell = c.cell)
    and not exists (select 1 from public.cell_hourly h where h.cell = c.cell);

  begin
    delete from auth.audit_log_entries where created_at < now() - interval '25 hours';
  exception
    when undefined_table or insufficient_privilege then
      raise notice 'auth.audit_log_entries not purged: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.purge_retention() from public, anon, authenticated;

-- retention_status() reports it too.
create or replace function public.audit_log_oldest_hours()
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v numeric;
begin
  select round((extract(epoch from now() - min(created_at)) / 3600)::numeric, 1)
    into v from auth.audit_log_entries;
  return v;
exception
  when undefined_table or insufficient_privilege then
    return null;
end;
$$;

revoke all on function public.audit_log_oldest_hours() from public, anon, authenticated;
grant execute on function public.audit_log_oldest_hours() to service_role;
