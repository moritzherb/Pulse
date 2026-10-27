-- Pulse: venues on the map and the cell / venue detail sheet.

-- ---------------------------------------------------------------- venues ---
-- rank: how prominent a venue is, used to pick which pins to draw when the
--   map is crowded. 3 landmark (Wikidata + sight/park), 2 notable, 1 ordinary,
--   0 never drawn (simulated seed venues).
-- kind: the OSM type in plain words ("bar", "museum"), shown in the sheet.
alter table public.venues
  add column rank smallint not null default 1 check (rank between 0 and 3),
  add column kind text,
  add column imported_at timestamptz not null default now();

alter table public.places
  add column imported_at timestamptz not null default now();

create index venues_rank_idx on public.venues (rank desc);

-- Venues inside a map viewport, most prominent first. Public OSM data, so
-- this runs with the caller's rights (venues are readable by everyone).
-- Returns nothing for viewports wider than ~0.12 degrees: pins are only
-- drawn at street zoom.
create or replace function public.venues_in_bbox(
  p_west   double precision,
  p_south  double precision,
  p_east   double precision,
  p_north  double precision,
  p_limit  integer default 200
)
returns table (
  id        bigint,
  name      text,
  category  text,
  kind      text,
  lng       double precision,
  lat       double precision,
  cell      text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.name, v.category, v.kind,
         extensions.st_x(v.geom::extensions.geometry),
         extensions.st_y(v.geom::extensions.geometry),
         v.cell
  from public.venues v
  where p_east - p_west between 0 and 0.12
    and p_north - p_south between 0 and 0.12
    and v.rank > 0
    and v.geom operator(extensions.&&)
        extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::extensions.geography
  order by v.rank desc, v.id
  limit least(greatest(p_limit, 0), 400)
$$;

revoke all on function public.venues_in_bbox(double precision, double precision, double precision, double precision, integer)
  from public;
grant execute on function public.venues_in_bbox(double precision, double precision, double precision, double precision, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------- detail ---
-- Everything the detail sheet shows for one cell:
--   label   nearest place name, also when the cell is not live
--   live    the current k-anonymous row, or null when under 5 devices
--   usual   typical devices per local weekday and hour, averaged over the
--           history (hours where the cell was under k count as 0). Empty
--           until the cell has history in at least 3 different weeks.
--   venues  up to 8 venues in the cell, most prominent first
--
-- History is built only from k-anonymous snapshots, so nothing here can be
-- traced to a person. p_tz is an IANA zone name from the phone, used only to
-- bucket hours locally; unknown zones fall back to UTC.
create or replace function public.get_cell_detail(p_cell text, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz      text := 'UTC';
  v_live    jsonb;
  v_weeks   integer;
  v_hours   jsonb := '[]'::jsonb;
  v_venues  jsonb;
  v_label   text;
begin
  if p_cell is null or p_cell !~ '^88[0-9a-f]{13}$' then
    return null;
  end if;
  if exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz) then
    v_tz := p_tz;
  end if;

  select jsonb_build_object(
           'devices', l.devices, 'level', l.level, 'trend', l.trend,
           'label', l.label, 'category', l.category, 'updatedAt', l.updated_at)
    into v_live
  from public.live_cells l
  where l.cell = p_cell;

  -- A name for the sheet title even when the cell is not live right now.
  select coalesce(v_live ->> 'label', (
    select p.name
    from public.cells c
    join public.places p on extensions.st_dwithin(p.geom, c.center, 1200)
    where c.cell = p_cell
    order by p.geom operator(extensions.<->) c.center
    limit 1
  )) into v_label;

  select count(distinct date_trunc('week', h.hour_start at time zone v_tz))
    into v_weeks
  from public.cell_hourly h
  where h.cell = p_cell and h.hour_start > now() - interval '12 months';

  if v_weeks >= 3 then
    select coalesce(jsonb_agg(jsonb_build_object('d', d, 'h', hr, 'v', round(v, 1)) order by d, hr), '[]'::jsonb)
      into v_hours
    from (
      select
        extract(isodow from r.hour_start at time zone v_tz)::integer as d,
        extract(hour from r.hour_start at time zone v_tz)::integer as hr,
        avg(coalesce(h.devices_sum::numeric / r.samples, 0)) as v
      from public.snapshot_runs r
      left join public.cell_hourly h on h.hour_start = r.hour_start and h.cell = p_cell
      where r.hour_start > now() - interval '12 months'
      group by 1, 2
    ) s;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'category', category, 'kind', kind)), '[]'::jsonb)
    into v_venues
  from (
    select v.id, v.name, v.category, v.kind
    from public.venues v
    where v.cell = p_cell and v.rank > 0
    order by v.rank desc, v.name
    limit 8
  ) x;

  return jsonb_build_object(
    'cell', p_cell,
    'label', v_label,
    'live', v_live,
    'usual', jsonb_build_object('weeks', coalesce(v_weeks, 0), 'hours', v_hours),
    'venues', v_venues
  );
end;
$$;

revoke all on function public.get_cell_detail(text, text) from public;
grant execute on function public.get_cell_detail(text, text) to anon, authenticated;
