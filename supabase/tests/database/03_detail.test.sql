-- Venues in a viewport, place outlines for the phone, and the detail sheet.
begin;
select plan(15);

insert into public.places (name, geom, source, source_id) values
  ('Innere Stadt', extensions.st_geogfromtext('SRID=4326;POINT(16.3738 48.2082)'), 'test', 'p1');
insert into public.venues (id, name, category, kind, rank, geom, cell, region, radius_m, area_m2, shape, source, source_id)
overriding system value values
  (1, 'Dom Museum', 'sights', 'museum', 3, extensions.st_geogfromtext('SRID=4326;POINT(16.3740 48.2090)'),
   '881e15b713fffff', '851e15b7fffffff', null, 2000,
   extensions.st_geogfromtext('SRID=4326;MULTIPOLYGON(((16.3735 48.2087,16.3745 48.2087,16.3745 48.2093,16.3735 48.2093,16.3735 48.2087)))'),
   'test', 'v1'),
  (2, 'Bar Eins', 'nightlife', 'bar', 1, extensions.st_geogfromtext('SRID=4326;POINT(16.3750 48.2100)'),
   '881e15b713fffff', '851e15b7fffffff', 20, 1257, null, 'test', 'v2'),
  (3, 'Hidden', 'food', null, 0, extensions.st_geogfromtext('SRID=4326;POINT(16.3745 48.2101)'),
   '881e15b713fffff', '851e15b7fffffff', 20, 1257, null, 'seed', 'v3'),
  (4, 'Far Away', 'food', 'cafe', 2, extensions.st_geogfromtext('SRID=4326;POINT(16.2000 48.3000)'),
   '881e15b711fffff', '851e15a7fffffff', 20, 1257, null, 'test', 'v4');

-- ---------------------------------------------------------- venues_in_bbox ---
set local role anon;
select results_eq(
  $$select name from public.venues_in_bbox(16.36, 48.20, 16.39, 48.22)$$,
  $$values ('Dom Museum'::text), ('Bar Eins'::text)$$,
  'returns venues in view, most prominent first, without rank-0 venues'
);
select is(
  (select count(*)::int from public.venues_in_bbox(16.0, 48.0, 16.6, 48.4)),
  0, 'returns nothing for city-wide viewports'
);

-- ------------------------------------------------------------ venue_shapes ---
select is(
  jsonb_array_length(public.venue_shapes('851e15b7fffffff') -> 'circles'), 2,
  'circles for places mapped as points, in the asked region only'
);
select is(
  (public.venue_shapes('851e15b7fffffff') -> 'circles' -> 0 -> 3)::int, 20,
  'a circle carries its radius'
);
select is(
  (public.venue_shapes('851e15b7fffffff') -> 'polygons' -> 0 -> 0)::int, 1,
  'outlines are included as polygons'
);
select is(
  jsonb_typeof(public.venue_shapes('851e15b7fffffff') -> 'polygons' -> 0 -> 2 -> 0 -> 0 -> 0), 'array',
  'polygon coordinates are MultiPolygon rings'
);
select is(public.venue_shapes('not a region'), null, 'malformed regions return nothing');
reset role;

-- -------------------------------------------------------- get_venue_detail ---
set local role anon;
select is(public.get_venue_detail(999), null, 'unknown places return null');
select is(public.get_venue_detail(3), null, 'hidden places return null');
select is(public.get_venue_detail(1) -> 'live', 'null'::jsonb, 'live is null under k');
select is(public.get_venue_detail(1) -> 'place' ->> 'area', 'Innere Stadt', 'the area name comes from the nearest place name');
select is((public.get_venue_detail(1) -> 'usual' ->> 'weeks')::int, 0, 'no history yet');
reset role;

insert into public.live_venues (venue_id, region, name, category, lng, lat, devices, level, trend) values
  (1, '851e15b7fffffff', 'Dom Museum', 'sights', 16.3740, 48.2090, 25, 3, 1),
  (2, '851e15b7fffffff', 'Bar Eins', 'nightlife', 16.3750, 48.2100, 10, 2, 0),
  (4, '851e15a7fffffff', 'Far Away', 'food', 16.2000, 48.3000, 40, 4, 0);
select is(public.get_venue_detail(1) -> 'live' ->> 'devices', '25', 'the live row is included');
select is(
  public.get_venue_detail(1) -> 'nearby', '[{"id": 2, "name": "Bar Eins", "level": 2, "devices": 10, "category": "nightlife"}]'::jsonb,
  'nearby lists other live places within 400 m only'
);

insert into public.snapshot_runs (hour_start, samples)
select date_trunc('hour', now()) - (w * interval '7 days'), 4 from generate_series(1, 4) w;
insert into public.venue_hourly (venue_id, hour_start, devices_sum, samples)
select 1, date_trunc('hour', now()) - (w * interval '7 days'), 40, 4 from generate_series(1, 3) w;
select is(
  (select (e ->> 'v')::numeric from jsonb_array_elements(
     public.get_venue_detail(1, 'Europe/Vienna') -> 'usual' -> 'hours') e),
  7.5, 'typical value averages snapshots and counts hours under k as 0'
);

select * from finish();
rollback;
