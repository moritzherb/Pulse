-- The world overview: live places summarised per region.
begin;
select plan(3);

insert into public.venues (id, name, category, geom, cell, region, radius_m, source, source_id)
overriding system value values
  (1, 'A', 'food', extensions.st_geogfromtext('SRID=4326;POINT(16.36 48.21)'), '881e15b713fffff', '851e15b7fffffff', 20, 'test', 'v1'),
  (2, 'B', 'food', extensions.st_geogfromtext('SRID=4326;POINT(16.38 48.21)'), '881e15b713fffff', '851e15b7fffffff', 20, 'test', 'v2'),
  (3, 'C', 'sights', extensions.st_geogfromtext('SRID=4326;POINT(2.35 48.86)'), '881fb46623fffff', '851fb467fffffff', 20, 'test', 'v3');
insert into public.live_venues (venue_id, region, name, category, lng, lat, devices, level) values
  (1, '851e15b7fffffff', 'A', 'food', 16.36, 48.21, 10, 2),
  (2, '851e15b7fffffff', 'B', 'food', 16.38, 48.21, 40, 4),
  (3, '851fb467fffffff', 'C', 'sights', 2.35, 48.86, 5, 1);

set local role anon;
select is((select count(*)::int from public.live_overview()), 2, 'one row per region with live places');
select results_eq(
  $$select places, devices, level::int, round(lng::numeric, 2) from public.live_overview() where region = '851e15b7fffffff'$$,
  $$values (2, 50, 4, 16.37)$$, 'summed devices, busiest level, centre of its places'
);
reset role;

delete from public.live_venues;
select is((select count(*)::int from public.live_overview()), 0, 'nothing live, nothing shown');

select * from finish();
rollback;
