-- Pulse: count people at places, not in 460 m areas.
--
-- A phone now reports the public place it is at (a café, a museum, a park),
-- found on the phone by checking its position against the place outlines,
-- or nothing when it is not at one. The report is `{ venue: <id> }`: still
-- no coordinates, and homes or offices can never be reported because they
-- are not places in this table.
--
-- Privacy rules, unchanged in spirit:
--   * Raw pings are unreadable by any client role and deleted after 20 min.
--   * Only places with >= 5 distinct devices reach `live_venues`, enforced by
--     a constraint.
--   * Every row tied to a person cascades from auth.users.
--
-- Replaces the cell pipeline (cells, live_cells, cell_hourly). Pings are
-- ephemeral, so they are simply dropped; cell history cannot be mapped onto
-- places and is dropped too.

-- ------------------------------------------------------ old cell pipeline ---
select cron.unschedule(jobname) from cron.job where jobname = 'pulse-refresh-live-cells';

drop function if exists public.refresh_live_cells(interval);
drop function if exists public.get_cell_detail(text, text);
drop function if exists public.record_ping(uuid, text, text, double precision, double precision, interval, interval);

drop table if exists public.live_cells, public.cell_hourly;
truncate public.pings;
alter table public.pings drop column cell;
drop table if exists public.cells;

-- ----------------------------------------------------------------- venues ---
-- shape     the place's outline from OpenStreetMap (buildings, parks, squares)
-- radius_m  for places mapped as a single point: a circle of this radius
-- area_m2   size of the outline or circle; the phone picks the smallest place
--           that contains it, so a café inside a museum wins over the museum
-- region    H3 resolution-5 cell (~250 km²) of the place, for download and
--           Realtime topics
-- usual_peak  typical devices in the place's busiest hour of the week, from
--           its own history (refresh_usual_peaks); levels are relative to it
alter table public.venues
  add column shape extensions.geography(MultiPolygon, 4326),
  add column radius_m smallint check (radius_m between 5 and 500),
  add column area_m2 real check (area_m2 > 0),
  add column region text check (region ~ '^85[0-9a-f]{13}$'),
  add column usual_peak real check (usual_peak >= 0);

-- New rows must be matchable. Existing rows get a shape on the next import.
alter table public.venues
  add constraint venues_matchable check (shape is not null or radius_m is not null) not valid;

create index venues_region_idx on public.venues (region);
create index venues_shape_gix on public.venues using gist (shape);

-- ------------------------------------------------------------------ pings ---
alter table public.pings
  add column venue_id bigint not null references public.venues (id) on delete cascade;
create index pings_venue_created_idx on public.pings (venue_id, created_at);

-- ------------------------------------------------------------ live_venues ---
-- The only crowd data clients can read. Name, category and position are the
-- place's public OpenStreetMap data, copied in so the map needs one query.
create table public.live_venues (
  venue_id    bigint primary key references public.venues (id) on delete cascade,
  region      text not null,
  name        text not null,
  category    text not null check (category in ('nightlife', 'food', 'sights', 'outdoors')),
  kind        text,
  lng         double precision not null,
  lat         double precision not null,
  devices     integer not null check (devices >= 5 and devices % 5 = 0),
  level       smallint not null check (level between 1 and 4),
  trend       smallint not null default 0 check (trend between -1 and 1),
  updated_at  timestamptz not null default now()
);
create index live_venues_region_idx on public.live_venues (region);

-- ----------------------------------------------------------- venue_hourly ---
-- History for "usually busy at" and usual_peak. Built from 15-minute
-- snapshots of live_venues (already k-anonymous). Kept 12 months.
create table public.venue_hourly (
  venue_id     bigint not null references public.venues (id) on delete cascade,
  hour_start   timestamptz not null,
  devices_sum  integer not null check (devices_sum >= 0),
  samples      smallint not null check (samples > 0),
  primary key (venue_id, hour_start)
);

alter table public.live_venues  enable row level security;
alter table public.venue_hourly enable row level security;

revoke all on public.venue_hourly from anon, authenticated;
revoke insert, update, delete, truncate on public.live_venues from anon, authenticated;
grant select on public.live_venues to anon, authenticated;
create policy live_venues_read on public.live_venues
  for select to anon, authenticated using (true);

-- ------------------------------------------------------------------ levels ---
-- Busy means busy for this place. Once a place has history, its level is the
-- current count against its usual peak, so a café and a park are judged on
-- their own scale and the level does not depend on how many people use
-- Pulse. Until then, the fixed thresholds of level_for() apply.
-- Mirrors levelForPlace() in supabase/functions/_shared/levels.ts.
create or replace function public.level_for_place(devices integer, usual_peak real)
returns smallint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (case
    when usual_peak is null or usual_peak < 10 then public.level_for(devices)
    when devices >= usual_peak * 0.85 then 4
    when devices >= usual_peak * 0.6 then 3
    when devices >= usual_peak * 0.35 then 2
    else 1
  end)::smallint
$$;

-- ------------------------------------------------------------------ intake ---
-- Called by the `ping` Edge Function with the service role, after it has
-- verified the user's JWT. Returns: ok | rate_limited | too_new |
-- unknown_user | unknown_venue
create or replace function public.record_ping(
  p_user             uuid,
  p_venue            bigint,
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

  if not exists (
    select 1 from public.venues v
    where v.id = p_venue and v.region is not null
      and (v.shape is not null or v.radius_m is not null)
  ) then
    return 'unknown_venue';
  end if;

  -- Fresh identities are cheap to mint; making them wait raises the cost of
  -- inventing extra "devices" to push a place over the k threshold.
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

  insert into public.pings (user_id, venue_id) values (p_user, p_venue);
  return 'ok';
end;
$$;

revoke all on function public.record_ping(uuid, bigint, interval, interval)
  from public, anon, authenticated;
grant execute on function public.record_ping(uuid, bigint, interval, interval) to service_role;

-- ------------------------------------------------------------- aggregation ---
-- Every minute: distinct devices per place over the window, nothing under
-- k = 5, rounded to 5, level against the place's usual peak, trend from the
-- newer vs older half of the window. Writes the difference into live_venues
-- and broadcasts it per region.
create or replace function public.refresh_live_venues(p_window interval default interval '15 minutes')
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
  with per_venue as (
    select
      p.venue_id,
      count(distinct p.user_id) as n,
      count(distinct p.user_id) filter (where p.created_at > v_now - p_window / 2) as n_recent,
      count(distinct p.user_id) filter (where p.created_at <= v_now - p_window / 2) as n_older
    from public.pings p
    where p.created_at > v_now - p_window
    group by p.venue_id
    having count(distinct p.user_id) >= 5 -- k-anonymity
  )
  select
    v.id as venue_id,
    v.region,
    v.name,
    v.category,
    v.kind,
    extensions.st_x(v.geom::extensions.geometry) as lng,
    extensions.st_y(v.geom::extensions.geometry) as lat,
    greatest(5, (round(pv.n / 5.0) * 5)::integer) as devices,
    v.usual_peak,
    (case
      when pv.n_recent > pv.n_older * 1.2 + 1 then 1
      when pv.n_recent < pv.n_older * 0.8 - 1 then -1
      else 0
    end)::smallint as trend
  from per_venue pv
  join public.venues v on v.id = pv.venue_id
  where v.region is not null;

  create temp table pulse_changed on commit drop as
  select a.*, public.level_for_place(a.devices, a.usual_peak) as level
  from pg_temp.pulse_agg a
  left join public.live_venues l on l.venue_id = a.venue_id
  where l.venue_id is null
     or (l.devices, l.trend, l.level, l.name, l.category)
        is distinct from (a.devices, a.trend, public.level_for_place(a.devices, a.usual_peak), a.name, a.category);

  create temp table pulse_removed on commit drop as
  select l.venue_id, l.region
  from public.live_venues l
  where not exists (select 1 from pg_temp.pulse_agg a where a.venue_id = l.venue_id);

  delete from public.live_venues l using pg_temp.pulse_removed x where l.venue_id = x.venue_id;

  insert into public.live_venues (venue_id, region, name, category, kind, lng, lat, devices, level, trend, updated_at)
  select venue_id, region, name, category, kind, lng, lat, devices, level, trend, v_now
  from pg_temp.pulse_changed
  on conflict (venue_id) do update set
    region     = excluded.region,
    name       = excluded.name,
    category   = excluded.category,
    kind       = excluded.kind,
    lng        = excluded.lng,
    lat        = excluded.lat,
    devices    = excluded.devices,
    level      = excluded.level,
    trend      = excluded.trend,
    updated_at = excluded.updated_at;

  -- One message per region that changed. Public: the same k-anonymous data
  -- anyone can read from live_venues.
  for r in
    select
      region,
      coalesce(
        jsonb_agg(jsonb_build_object(
          'id', venue_id, 'name', name, 'category', category, 'kind', kind,
          'lng', lng, 'lat', lat, 'devices', devices, 'level', level, 'trend', trend
        )) filter (where k = 'u'),
        '[]'::jsonb
      ) as upserts,
      coalesce(jsonb_agg(to_jsonb(venue_id)) filter (where k = 'r'), '[]'::jsonb) as removed
    from (
      select region, venue_id, name, category, kind, lng, lat, devices, level, trend, 'u' as k
      from pg_temp.pulse_changed
      union all
      select region, venue_id, null, null, null, null, null, null, null, null, 'r'
      from pg_temp.pulse_removed
    ) d
    group by region
  loop
    perform realtime.send(
      jsonb_build_object('upserts', r.upserts, 'removed', r.removed, 'at', v_now),
      'places',
      'region:' || r.region,
      false
    );
    v_regions := v_regions + 1;
  end loop;

  perform realtime.send(jsonb_build_object('at', v_now), 'tick', 'pulse:tick', false);
  return v_regions;
end;
$$;

revoke all on function public.refresh_live_venues(interval) from public, anon, authenticated;

-- ----------------------------------------------------------------- history ---
create or replace function public.snapshot_hourly()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.snapshot_runs (hour_start, samples)
  values (date_trunc('hour', now()), 1)
  on conflict (hour_start) do update set samples = public.snapshot_runs.samples + 1;

  insert into public.venue_hourly (venue_id, hour_start, devices_sum, samples)
  select venue_id, date_trunc('hour', now()), devices, 1 from public.live_venues
  on conflict (venue_id, hour_start) do update set
    devices_sum = public.venue_hourly.devices_sum + excluded.devices_sum,
    samples     = public.venue_hourly.samples + 1;
$$;

revoke all on function public.snapshot_hourly() from public, anon, authenticated;

-- Daily: each place's usual peak, the busiest weekday-hour of its last 8
-- weeks (hours under k count as 0). Needs history in at least 3 different
-- weeks; otherwise the fixed thresholds apply.
create or replace function public.refresh_usual_peaks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  with enough as (
    select h.venue_id
    from public.venue_hourly h
    where h.hour_start > now() - interval '8 weeks'
    group by h.venue_id
    having count(distinct date_trunc('week', h.hour_start)) >= 3
  ),
  buckets as (
    select
      e.venue_id,
      avg(coalesce(h.devices_sum::numeric / r.samples, 0)) as v
    from enough e
    cross join public.snapshot_runs r
    left join public.venue_hourly h on h.venue_id = e.venue_id and h.hour_start = r.hour_start
    where r.hour_start > now() - interval '8 weeks'
    group by e.venue_id, extract(isodow from r.hour_start), extract(hour from r.hour_start)
  ),
  peaks as (
    select venue_id, max(v)::real as peak from buckets group by venue_id
  )
  update public.venues v
  set usual_peak = p.peak
  from (
    select v2.id, pk.peak
    from public.venues v2
    left join peaks pk on pk.venue_id = v2.id
    where v2.usual_peak is not null or pk.peak is not null
  ) p
  where v.id = p.id and v.usual_peak is distinct from p.peak;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.refresh_usual_peaks() from public, anon, authenticated;

-- --------------------------------------------------------------- retention ---
create or replace function public.purge_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users u
  where u.is_anonymous and u.created_at < now() - interval '25 hours';

  delete from public.venue_hourly where hour_start < now() - interval '12 months';
  delete from public.snapshot_runs where hour_start < now() - interval '12 months';

  begin
    delete from auth.audit_log_entries where created_at < now() - interval '25 hours';
  exception
    when undefined_table or insufficient_privilege then
      raise notice 'auth.audit_log_entries not purged: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.purge_retention() from public, anon, authenticated;

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
    'live_venues', (select count(*) from public.live_venues),
    'anonymous_users', (select count(*) from auth.users where is_anonymous),
    'anonymous_users_over_25h',
      (select count(*) from auth.users where is_anonymous and created_at < now() - interval '25 hours'),
    'oldest_history_days',
      (select round((extract(epoch from now() - min(hour_start)) / 86400)::numeric, 1) from public.venue_hourly),
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

-- ------------------------------------------------------------- client RPCs ---
-- Outlines of the places in one region, for matching on the phone. Public
-- OpenStreetMap data, so this runs with the caller's rights. The phone asks
-- for the region (~250 km²) it is in, nothing finer.
--   circles:  [id, lng, lat, radius_m, name]
--   polygons: [id, area_m2, MultiPolygon coordinates, name]   (simplified to ~2 m)
-- Names let the phone say where it is ("You're at Café Central") without
-- asking the server.
create or replace function public.venue_shapes(p_region text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'region', p_region,
    'circles', coalesce((
      select jsonb_agg(jsonb_build_array(
        v.id,
        round(extensions.st_x(v.geom::extensions.geometry)::numeric, 6),
        round(extensions.st_y(v.geom::extensions.geometry)::numeric, 6),
        v.radius_m,
        v.name))
      from public.venues v
      where v.region = p_region and v.shape is null and v.radius_m is not null
    ), '[]'::jsonb),
    'polygons', coalesce((
      select jsonb_agg(jsonb_build_array(
        v.id,
        round(coalesce(v.area_m2, extensions.st_area(v.shape))::numeric),
        extensions.st_asgeojson(extensions.st_multi(
          extensions.st_simplifypreservetopology(v.shape::extensions.geometry, 0.00002)), 6
        )::jsonb -> 'coordinates',
        v.name))
      from public.venues v
      where v.region = p_region and v.shape is not null
    ), '[]'::jsonb)
  )
  where p_region ~ '^85[0-9a-f]{13}$'
$$;

revoke all on function public.venue_shapes(text) from public;
grant execute on function public.venue_shapes(text) to anon, authenticated;

-- Everything the detail sheet shows for one place:
--   place   public data: name, category, kind, position, the area it is in
--   live    the current k-anonymous row, or null under 5 devices
--   usual   typical devices per local weekday and hour (empty until 3 weeks)
--   nearby  up to 6 live places within 400 m, busiest first
create or replace function public.get_venue_detail(p_venue bigint, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz      text := 'UTC';
  v_place   jsonb;
  v_geom    extensions.geography;
  v_live    jsonb;
  v_weeks   integer;
  v_hours   jsonb := '[]'::jsonb;
  v_nearby  jsonb;
begin
  if exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz) then
    v_tz := p_tz;
  end if;

  select
    jsonb_build_object(
      'id', v.id, 'name', v.name, 'category', v.category, 'kind', v.kind,
      'lng', extensions.st_x(v.geom::extensions.geometry),
      'lat', extensions.st_y(v.geom::extensions.geometry),
      'area', (
        select p.name from public.places p
        where extensions.st_dwithin(p.geom, v.geom, 1200)
        order by p.geom operator(extensions.<->) v.geom
        limit 1
      )),
    v.geom
    into v_place, v_geom
  from public.venues v
  where v.id = p_venue and v.rank > 0;

  if v_place is null then
    return null;
  end if;

  select jsonb_build_object(
           'devices', l.devices, 'level', l.level, 'trend', l.trend, 'updatedAt', l.updated_at)
    into v_live
  from public.live_venues l
  where l.venue_id = p_venue;

  select count(distinct date_trunc('week', h.hour_start at time zone v_tz))
    into v_weeks
  from public.venue_hourly h
  where h.venue_id = p_venue and h.hour_start > now() - interval '12 months';

  if v_weeks >= 3 then
    select coalesce(jsonb_agg(jsonb_build_object('d', d, 'h', hr, 'v', round(v, 1)) order by d, hr), '[]'::jsonb)
      into v_hours
    from (
      select
        extract(isodow from r.hour_start at time zone v_tz)::integer as d,
        extract(hour from r.hour_start at time zone v_tz)::integer as hr,
        avg(coalesce(h.devices_sum::numeric / r.samples, 0)) as v
      from public.snapshot_runs r
      left join public.venue_hourly h on h.hour_start = r.hour_start and h.venue_id = p_venue
      where r.hour_start > now() - interval '12 months'
      group by 1, 2
    ) s;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.venue_id, 'name', x.name, 'category', x.category,
           'devices', x.devices, 'level', x.level)), '[]'::jsonb)
    into v_nearby
  from (
    select l.venue_id, l.name, l.category, l.devices, l.level
    from public.live_venues l
    where l.venue_id <> p_venue
      and extensions.st_dwithin(
        extensions.st_setsrid(extensions.st_makepoint(l.lng, l.lat), 4326)::extensions.geography,
        v_geom, 400)
    order by l.level desc, l.devices desc
    limit 6
  ) x;

  return jsonb_build_object(
    'place', v_place,
    'live', v_live,
    'usual', jsonb_build_object('weeks', coalesce(v_weeks, 0), 'hours', v_hours),
    'nearby', v_nearby
  );
end;
$$;

revoke all on function public.get_venue_detail(bigint, text) from public;
grant execute on function public.get_venue_detail(bigint, text) to anon, authenticated;

-- -------------------------------------------------------------------- jobs ---
select cron.schedule('pulse-refresh-live-venues', '* * * * *', 'select public.refresh_live_venues()');
select cron.schedule('pulse-usual-peaks', '41 3 * * *', 'select public.refresh_usual_peaks()');
