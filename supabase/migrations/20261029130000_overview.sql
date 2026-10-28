-- Pulse: a world overview for zoomed-out maps.
--
-- Up close the app loads live places around the map centre. Zoomed out to a
-- country or the whole world, it asks for this instead: one row per region
-- (H3 resolution 5, ~250 km²) with live places, summarised. Built only from
-- live_venues, which is already public and k-anonymous, so it adds nothing
-- new about anyone.
create or replace function public.live_overview()
returns table (
  region   text,
  lng      double precision,
  lat      double precision,
  places   integer,
  devices  integer,
  level    smallint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.region, avg(l.lng), avg(l.lat), count(*)::integer, sum(l.devices)::integer, max(l.level)
  from public.live_venues l
  group by l.region
$$;

revoke all on function public.live_overview() from public;
grant execute on function public.live_overview() to anon, authenticated;
