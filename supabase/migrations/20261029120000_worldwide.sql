-- Pulse: places anywhere in the world.
--
-- Places are imported from OpenStreetMap per region (H3 resolution 5,
-- ~250 km²) on demand: the first time someone shares there or looks at it
-- at street zoom, the `import-region` Edge Function fetches the region's
-- public places. scripts/import-osm.ts uses the same path ahead of time.
--
-- Also: every place knows its time zone, so "usually busy at" shows the
-- place's local hours wherever the person looking is.

-- ------------------------------------------------------------- time zone ---
alter table public.venues
  add column tz text check (tz is null or char_length(tz) between 1 and 64);

-- Place names (neighbourhoods, squares) per region too, so a re-import can
-- remove names that disappeared from OSM.
alter table public.places
  add column region text check (region is null or region ~ '^85[0-9a-f]{13}$');
create index places_region_idx on public.places (region);

-- --------------------------------------------------------- region imports ---
-- One row per region ever requested. Private: no client role can read it.
create table public.region_imports (
  region       text primary key check (region ~ '^85[0-9a-f]{13}$'),
  status       text not null check (status in ('importing', 'done', 'failed')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  venues       integer check (venues >= 0),
  error        text
);
create index region_imports_started_idx on public.region_imports (started_at);

alter table public.region_imports enable row level security;
revoke all on public.region_imports from anon, authenticated;

-- Decide whether a region should be imported now. Returns:
--   fresh    imported within p_fresh: nothing to do
--   busy     an import started less than 15 minutes ago is still running
--   limited  p_max_per_hour imports already started in the last hour
--            (protects the public Overpass servers)
--   claimed  the caller should import it now; status is set to importing
create or replace function public.claim_region_import(
  p_region        text,
  p_max_per_hour  integer default 30,
  p_fresh         interval default interval '30 days'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.region_imports;
begin
  if p_region is null or p_region !~ '^85[0-9a-f]{13}$' then
    raise exception 'invalid region' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('pulse-region-import', 0));

  select * into r from public.region_imports where region = p_region;
  if r.status = 'done' and r.finished_at > now() - p_fresh then
    return 'fresh';
  end if;
  if r.status = 'importing' and r.started_at > now() - interval '15 minutes' then
    return 'busy';
  end if;
  if (select count(*) from public.region_imports
      where started_at > now() - interval '1 hour') >= p_max_per_hour then
    return 'limited';
  end if;

  insert into public.region_imports (region, status, started_at, finished_at, venues, error)
  values (p_region, 'importing', now(), null, null, null)
  on conflict (region) do update set
    status = 'importing', started_at = now(), finished_at = null, venues = null, error = null;
  return 'claimed';
end;
$$;

create or replace function public.finish_region_import(
  p_region  text,
  p_ok      boolean,
  p_venues  integer default null,
  p_error   text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.region_imports
  set status = case when p_ok then 'done' else 'failed' end,
      finished_at = now(),
      venues = p_venues,
      error = left(p_error, 500)
  where region = p_region;
$$;

-- Upsert OSM places from JSON rows (see VenueDbRow in _shared/osm/importRegion.ts).
-- Ids stay stable across imports, so phones' cached outlines and each
-- place's history stay valid.
create or replace function public.upsert_osm_venues(p_rows jsonb, p_imported_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  insert into public.venues
    (name, category, kind, rank, geom, cell, region, shape, radius_m, area_m2, tz, source, source_id, imported_at)
  select
    r.name, r.category, r.kind, r.rank,
    extensions.st_setsrid(extensions.st_makepoint(r.lng, r.lat), 4326)::extensions.geography,
    r.cell, r.region,
    case when r.shape is null then null else extensions.st_geogfromtext(r.shape) end,
    r.radius_m, r.area_m2, r.tz, 'osm', r.source_id, p_imported_at
  from jsonb_to_recordset(p_rows) as r(
    source_id text, name text, category text, kind text, rank smallint,
    lng double precision, lat double precision, cell text, region text,
    shape text, radius_m smallint, area_m2 real, tz text)
  on conflict (source, source_id) do update set
    name = excluded.name, category = excluded.category, kind = excluded.kind,
    rank = excluded.rank, geom = excluded.geom, cell = excluded.cell,
    region = excluded.region, shape = excluded.shape, radius_m = excluded.radius_m,
    area_m2 = excluded.area_m2, tz = excluded.tz, imported_at = excluded.imported_at;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.upsert_osm_places(p_rows jsonb, p_imported_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  insert into public.places (name, kind, geom, region, source, source_id, imported_at)
  select
    r.name, r.kind,
    extensions.st_setsrid(extensions.st_makepoint(r.lng, r.lat), 4326)::extensions.geography,
    r.region, 'osm', r.source_id, p_imported_at
  from jsonb_to_recordset(p_rows) as r(
    source_id text, name text, kind text, lng double precision, lat double precision, region text)
  on conflict (source, source_id) do update set
    name = excluded.name, kind = excluded.kind, geom = excluded.geom,
    region = excluded.region, imported_at = excluded.imported_at;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- After a complete import: OSM rows of the region it did not see are gone
-- from OSM (closed, renamed). Their history goes with them.
create or replace function public.prune_osm_region(p_region text, p_imported_before timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v integer; p integer;
begin
  delete from public.venues
  where source = 'osm' and region = p_region and imported_at < p_imported_before;
  get diagnostics v = row_count;
  delete from public.places
  where source = 'osm' and region = p_region and imported_at < p_imported_before;
  get diagnostics p = row_count;
  return jsonb_build_object('venues', v, 'places', p);
end;
$$;

revoke all on function public.claim_region_import(text, integer, interval) from public, anon, authenticated;
revoke all on function public.finish_region_import(text, boolean, integer, text) from public, anon, authenticated;
revoke all on function public.upsert_osm_venues(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.upsert_osm_places(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.prune_osm_region(text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_region_import(text, integer, interval) to service_role;
grant execute on function public.finish_region_import(text, boolean, integer, text) to service_role;
grant execute on function public.upsert_osm_venues(jsonb, timestamptz) to service_role;
grant execute on function public.upsert_osm_places(jsonb, timestamptz) to service_role;
grant execute on function public.prune_osm_region(text, timestamptz) to service_role;

-- ------------------------------------------------------------ venue_shapes ---
-- Now also says when the region was imported (null: never, so the phone asks
-- for an import). Security definer only to read that date; everything else
-- it returns is public OSM data.
create or replace function public.venue_shapes(p_region text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'region', p_region,
    'importedAt', (
      select i.finished_at from public.region_imports i
      where i.region = p_region and i.status = 'done'
    ),
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

-- -------------------------------------------------------- get_venue_detail ---
-- "Usually" now uses the place's own time zone (falls back to the phone's,
-- then UTC), and the place carries `tz` so the app can say "local time".
create or replace function public.get_venue_detail(p_venue bigint, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz      text := 'UTC';
  v_vtz     text;
  v_place   jsonb;
  v_geom    extensions.geography;
  v_live    jsonb;
  v_weeks   integer;
  v_hours   jsonb := '[]'::jsonb;
  v_nearby  jsonb;
begin
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
    v.geom,
    v.tz
    into v_place, v_geom, v_vtz
  from public.venues v
  where v.id = p_venue and v.rank > 0;

  if v_place is null then
    return null;
  end if;

  if exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_vtz) then
    v_tz := v_vtz;
  elsif exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz) then
    v_tz := p_tz;
  end if;
  v_place := v_place || jsonb_build_object('tz', v_tz);

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
