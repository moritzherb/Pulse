-- Pulse: core schema.
--
-- Privacy rules encoded here rather than left to app convention:
--   * No coordinate of a person is storable. The only location in a ping is an
--     H3 cell id (resolution 8, ~460 m). `cells.center` is the centre of that
--     public hexagon, computed from the id, not anyone's position.
--   * Raw pings are unreadable by any client role, forever.
--   * Only k-anonymous aggregates (>= 5 distinct devices) reach `live_cells`,
--     the one table clients can read crowd data from.
--   * Every row tied to a person references auth.users with ON DELETE CASCADE,
--     so deleting the anonymous user deletes everything linked to it.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;

-- --------------------------------------------------------------- levels ---
-- Mirrors supabase/functions/_shared/levels.ts. 1 quiet, 2 moderate, 3 busy, 4 packed.
create or replace function public.level_for(devices integer)
returns smallint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (case
    when devices >= 35 then 4
    when devices >= 20 then 3
    when devices >= 10 then 2
    else 1
  end)::smallint
$$;

-- ---------------------------------------------------------------- cells ---
-- One row per H3 cell that has ever been reported. Written only by the
-- `ping` Edge Function (service role). Not readable by clients: the mere
-- existence of a row says "someone was here once", so it is pruned after
-- 25 h unless the cell has k-anonymous history.
create table public.cells (
  cell        text primary key check (cell ~ '^88[0-9a-f]{13}$'),
  region      text not null check (region ~ '^85[0-9a-f]{13}$'),
  center      extensions.geography(point, 4326) not null,
  first_seen  timestamptz not null default now()
);
create index cells_center_gix on public.cells using gist (center);

-- ---------------------------------------------------------------- pings ---
-- Raw reports. Deleted after 20 minutes. The server sets the time.
create table public.pings (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  cell        text not null references public.cells (cell),
  created_at  timestamptz not null default now()
);
create index pings_created_at_idx on public.pings (created_at);
create index pings_cell_created_idx on public.pings (cell, created_at);
create index pings_user_created_idx on public.pings (user_id, created_at);

-- ----------------------------------------------------------- live_cells ---
-- The only crowd data clients can read. Every row has >= 5 distinct devices,
-- enforced by a constraint, so a bug elsewhere cannot leak a smaller count.
create table public.live_cells (
  cell        text primary key check (cell ~ '^88[0-9a-f]{13}$'),
  region      text not null,
  devices     integer not null check (devices >= 5 and devices % 5 = 0),
  level       smallint not null check (level between 1 and 4),
  trend       smallint not null default 0 check (trend between -1 and 1),
  category    text check (category in ('nightlife', 'food', 'sights', 'outdoors')),
  label       text,
  updated_at  timestamptz not null default now()
);
create index live_cells_region_idx on public.live_cells (region);

-- ---------------------------------------------------------- cell_hourly ---
-- History for "usually busy at". Built from 15-minute snapshots of
-- live_cells (already k-anonymous), never from raw pings. Kept 12 months.
-- Typical devices for a cell-hour = devices_sum / snapshot_runs.samples.
create table public.cell_hourly (
  cell         text not null,
  hour_start   timestamptz not null,
  devices_sum  integer not null check (devices_sum >= 0),
  samples      smallint not null check (samples > 0),
  primary key (cell, hour_start)
);

-- How many snapshots ran in each hour, so hours where a cell was below k
-- count as quiet instead of being skipped.
create table public.snapshot_runs (
  hour_start  timestamptz primary key,
  samples     smallint not null check (samples > 0)
);

-- --------------------------------------------------- places and venues ---
-- Public OpenStreetMap data. Places name an area ("Naschmarkt"); venues
-- (bars, cafés, museums, parks) give a cell its category and the map its pins.
create table public.places (
  id         bigint generated always as identity primary key,
  name       text not null,
  kind       text not null default 'area' check (kind in ('area', 'landmark')),
  geom       extensions.geography(point, 4326) not null,
  source     text not null default 'osm',
  source_id  text not null,
  unique (source, source_id)
);
create index places_geom_gix on public.places using gist (geom);

create table public.venues (
  id         bigint generated always as identity primary key,
  name       text not null,
  category   text not null check (category in ('nightlife', 'food', 'sights', 'outdoors')),
  geom       extensions.geography(point, 4326) not null,
  cell       text not null check (cell ~ '^88[0-9a-f]{13}$'),
  source     text not null default 'osm',
  source_id  text not null,
  unique (source, source_id)
);
create index venues_geom_gix on public.venues using gist (geom);
create index venues_cell_idx on public.venues (cell);

-- ------------------------------------------------------ consent_records ---
-- Proof of consent (GDPR Art. 7(1)), owned by the anonymous user and
-- deleted with it.
create table public.consent_records (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose         text not null check (purpose in ('location')),
  granted         boolean not null,
  policy_version  text not null check (char_length(policy_version) between 1 and 32),
  recorded_at     timestamptz not null default now()
);
create index consent_user_idx on public.consent_records (user_id, recorded_at desc);

-- ------------------------------------------------- row level security ---
alter table public.cells           enable row level security;
alter table public.pings           enable row level security;
alter table public.live_cells      enable row level security;
alter table public.cell_hourly     enable row level security;
alter table public.snapshot_runs   enable row level security;
alter table public.places          enable row level security;
alter table public.venues          enable row level security;
alter table public.consent_records enable row level security;

-- Private tables: no policies at all, and no privileges either. Belt and braces:
-- Supabase grants table privileges to API roles by default.
revoke all on public.cells, public.pings, public.cell_hourly, public.snapshot_runs
  from anon, authenticated;

-- Public read-only tables.
revoke insert, update, delete, truncate on public.live_cells, public.places, public.venues
  from anon, authenticated;
grant select on public.live_cells, public.places, public.venues to anon, authenticated;

create policy live_cells_read on public.live_cells
  for select to anon, authenticated using (true);
create policy places_read on public.places
  for select to anon, authenticated using (true);
create policy venues_read on public.venues
  for select to anon, authenticated using (true);

-- Consent: an anonymous user may record and read only their own decisions.
revoke all on public.consent_records from anon, authenticated;
grant select, insert on public.consent_records to authenticated;

create policy consent_insert_own on public.consent_records
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy consent_read_own on public.consent_records
  for select to authenticated using (user_id = (select auth.uid()));
