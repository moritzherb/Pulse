-- Pulse: ping intake, k-anonymous aggregation, Realtime fan-out, history,
-- retention, and the two client RPCs.
--
-- Every function is SECURITY DEFINER with an empty search_path, so all
-- references are schema-qualified. EXECUTE is revoked from PUBLIC and granted
-- only to the role that needs it.

-- ------------------------------------------------------------ intake ------
-- Called by the `ping` Edge Function with the service role, after it has
-- verified the user's JWT and validated the H3 cell. Returns a status string:
--   ok | rate_limited | too_new | unknown_user
create or replace function public.record_ping(
  p_user             uuid,
  p_cell             text,
  p_region           text,
  p_center_lng       double precision,
  p_center_lat       double precision,
  p_min_interval     interval default interval '60 seconds',
  p_min_account_age  interval default interval '0 seconds'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created timestamptz;
begin
  select u.created_at into v_created from auth.users u where u.id = p_user;
  if v_created is null then
    return 'unknown_user';
  end if;

  -- Fresh identities are cheap to mint; making them wait raises the cost of
  -- inventing extra "devices" to push a cell over the k threshold.
  if v_created > now() - p_min_account_age then
    return 'too_new';
  end if;

  -- Serialise per user so concurrent requests cannot both pass the check.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if exists (
    select 1 from public.pings p
    where p.user_id = p_user and p.created_at > now() - p_min_interval
  ) then
    return 'rate_limited';
  end if;

  -- p_center_* is the centre of the public H3 hexagon, derived from the id.
  insert into public.cells (cell, region, center)
  values (
    p_cell,
    p_region,
    extensions.st_setsrid(extensions.st_makepoint(p_center_lng, p_center_lat), 4326)::extensions.geography
  )
  on conflict (cell) do nothing;

  insert into public.pings (user_id, cell) values (p_user, p_cell);
  return 'ok';
end;
$$;

revoke all on function public.record_ping(uuid, text, text, double precision, double precision, interval, interval)
  from public, anon, authenticated;
grant execute on function public.record_ping(uuid, text, text, double precision, double precision, interval, interval)
  to service_role;

-- ------------------------------------------------------- aggregation ------
-- Runs every minute (pg_cron). Counts distinct devices per cell over the
-- window, drops anything under k = 5, rounds to 5, derives level and trend,
-- writes the difference into live_cells and broadcasts it per region.
--
-- Trend compares distinct devices in the newer and older half of the window,
-- with a dead band so normal churn reads as steady.
create or replace function public.refresh_live_cells(p_window interval default interval '15 minutes')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now      timestamptz := now();
  v_regions  integer := 0;
  r          record;
begin
  drop table if exists pg_temp.pulse_agg, pg_temp.pulse_changed, pg_temp.pulse_removed;

  create temp table pulse_agg on commit drop as
  with recent as (
    select p.cell, c.region, c.center, p.user_id, p.created_at
    from public.pings p
    join public.cells c on c.cell = p.cell
    where p.created_at > v_now - p_window
  ),
  per_cell as (
    select
      cell,
      region,
      center,
      count(distinct user_id) as n,
      count(distinct user_id) filter (where created_at > v_now - p_window / 2) as n_recent,
      count(distinct user_id) filter (where created_at <= v_now - p_window / 2) as n_older
    from recent
    group by cell, region, center
    having count(distinct user_id) >= 5 -- k-anonymity
  )
  select
    pc.cell,
    pc.region,
    greatest(5, (round(pc.n / 5.0) * 5)::integer) as devices,
    (case
      when pc.n_recent > pc.n_older * 1.2 + 1 then 1
      when pc.n_recent < pc.n_older * 0.8 - 1 then -1
      else 0
    end)::smallint as trend,
    pl.name as label,
    vc.category
  from per_cell pc
  left join lateral (
    select p.name
    from public.places p
    where extensions.st_dwithin(p.geom, pc.center, 1200)
    order by p.geom operator(extensions.<->) pc.center
    limit 1
  ) pl on true
  left join lateral (
    select v.category
    from public.venues v
    where extensions.st_dwithin(v.geom, pc.center, 400)
    group by v.category
    order by count(*) desc, v.category
    limit 1
  ) vc on true;

  create temp table pulse_changed on commit drop as
  select a.*, public.level_for(a.devices) as level
  from pg_temp.pulse_agg a
  left join public.live_cells l on l.cell = a.cell
  where l.cell is null
     or (l.devices, l.trend, l.label, l.category)
        is distinct from (a.devices, a.trend, a.label, a.category);

  create temp table pulse_removed on commit drop as
  select l.cell, l.region
  from public.live_cells l
  where not exists (select 1 from pg_temp.pulse_agg a where a.cell = l.cell);

  delete from public.live_cells l using pg_temp.pulse_removed x where l.cell = x.cell;

  insert into public.live_cells (cell, region, devices, level, trend, label, category, updated_at)
  select cell, region, devices, level, trend, label, category, v_now from pg_temp.pulse_changed
  on conflict (cell) do update set
    devices    = excluded.devices,
    level      = excluded.level,
    trend      = excluded.trend,
    label      = excluded.label,
    category   = excluded.category,
    updated_at = excluded.updated_at;

  -- One message per region that changed. Topics are public: the payload is
  -- the same k-anonymous data anyone can read from live_cells.
  for r in
    select
      region,
      coalesce(
        jsonb_agg(jsonb_build_object(
          'cell', cell, 'devices', devices, 'level', level, 'trend', trend,
          'label', label, 'category', category
        )) filter (where kind = 'u'),
        '[]'::jsonb
      ) as upserts,
      coalesce(jsonb_agg(to_jsonb(cell)) filter (where kind = 'r'), '[]'::jsonb) as removed
    from (
      select region, cell, devices, level, trend, label, category, 'u' as kind from pg_temp.pulse_changed
      union all
      select region, cell, null::integer, null::smallint, null::smallint, null::text, null::text, 'r'
      from pg_temp.pulse_removed
    ) d
    group by region
  loop
    perform realtime.send(
      jsonb_build_object('upserts', r.upserts, 'removed', r.removed, 'at', v_now),
      'cells',
      'region:' || r.region,
      false
    );
    v_regions := v_regions + 1;
  end loop;

  -- Heartbeat so clients can show "updated 12s ago" even when nothing changed.
  perform realtime.send(jsonb_build_object('at', v_now), 'tick', 'pulse:tick', false);

  return v_regions;
end;
$$;

revoke all on function public.refresh_live_cells(interval) from public, anon, authenticated;

-- ----------------------------------------------------------- history ------
-- Runs every 15 minutes. Adds the current k-anonymous counts to the hour.
create or replace function public.snapshot_hourly()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.snapshot_runs (hour_start, samples)
  values (date_trunc('hour', now()), 1)
  on conflict (hour_start) do update set samples = public.snapshot_runs.samples + 1;

  insert into public.cell_hourly (cell, hour_start, devices_sum, samples)
  select cell, date_trunc('hour', now()), devices, 1 from public.live_cells
  on conflict (cell, hour_start) do update set
    devices_sum = public.cell_hourly.devices_sum + excluded.devices_sum,
    samples     = public.cell_hourly.samples + 1;
$$;

revoke all on function public.snapshot_hourly() from public, anon, authenticated;

-- --------------------------------------------------------- retention ------
-- Every minute: raw pings older than 20 minutes are gone.
create or replace function public.purge_expired_pings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.pings where created_at < now() - interval '20 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Hourly: identities, history and cell metadata past their retention.
--   * Anonymous users older than 25 h. The app rotates to a new identity every
--     24 h, so these are abandoned. Deleting cascades to their consent records.
--   * cell_hourly / snapshot_runs older than 12 months.
--   * cells rows older than 25 h with no pings and no k-anonymous history.
create or replace function public.purge_retention()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users u
  where u.is_anonymous and u.created_at < now() - interval '25 hours';

  delete from public.cell_hourly where hour_start < now() - interval '12 months';
  delete from public.snapshot_runs where hour_start < now() - interval '12 months';

  delete from public.cells c
  where c.first_seen < now() - interval '25 hours'
    and not exists (select 1 from public.pings p where p.cell = c.cell)
    and not exists (select 1 from public.live_cells l where l.cell = c.cell)
    and not exists (select 1 from public.cell_hourly h where h.cell = c.cell);
$$;

revoke all on function public.purge_expired_pings() from public, anon, authenticated;
revoke all on function public.purge_retention() from public, anon, authenticated;

-- ------------------------------------------------------- client RPCs ------
-- "N rows linked to this ID" in Settings.
create or replace function public.my_outstanding_pings()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.pings where user_id = (select auth.uid())
$$;

-- Switching sharing off deletes what was already sent, not just future pings.
create or replace function public.delete_my_pings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.pings where user_id = (select auth.uid());
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.my_outstanding_pings() from public, anon;
revoke all on function public.delete_my_pings() from public, anon;
grant execute on function public.my_outstanding_pings() to authenticated;
grant execute on function public.delete_my_pings() to authenticated;
