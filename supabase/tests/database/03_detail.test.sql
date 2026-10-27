-- Venues in a viewport and the detail sheet query.
begin;
select plan(14);

insert into public.cells (cell, region, center) values
  ('881e15b713fffff', '851e15b7fffffff', extensions.st_geogfromtext('SRID=4326;POINT(16.374698 48.210355)'));
insert into public.places (name, geom, source, source_id) values
  ('Stephansplatz', extensions.st_geogfromtext('SRID=4326;POINT(16.3738 48.2082)'), 'test', 'p1');
insert into public.venues (name, category, kind, rank, geom, cell, source, source_id) values
  ('Dom Museum', 'sights', 'museum', 3, extensions.st_geogfromtext('SRID=4326;POINT(16.3740 48.2090)'), '881e15b713fffff', 'test', 'v1'),
  ('Bar Eins', 'nightlife', 'bar', 1, extensions.st_geogfromtext('SRID=4326;POINT(16.3750 48.2100)'), '881e15b713fffff', 'test', 'v2'),
  ('Simulated', 'food', null, 0, extensions.st_geogfromtext('SRID=4326;POINT(16.3745 48.2101)'), '881e15b713fffff', 'seed', 'v3'),
  ('Far Away', 'food', 'cafe', 2, extensions.st_geogfromtext('SRID=4326;POINT(16.2000 48.3000)'), '881e15b711fffff', 'test', 'v4');

-- ---------------------------------------------------------- venues_in_bbox ---
set local role anon;
select results_eq(
  $$select name from public.venues_in_bbox(16.36, 48.20, 16.39, 48.22)$$,
  $$values ('Dom Museum'::text), ('Bar Eins'::text)$$,
  'returns venues in view, most prominent first, without rank-0 seed venues'
);
select is(
  (select count(*)::int from public.venues_in_bbox(16.0, 48.0, 16.6, 48.4)),
  0, 'returns nothing for city-wide viewports'
);
select is(
  (select count(*)::int from public.venues_in_bbox(16.36, 48.20, 16.39, 48.22, 1)),
  1, 'respects the limit'
);
select ok(
  (select abs(lng - 16.374) < 0.001 and abs(lat - 48.209) < 0.001
   from public.venues_in_bbox(16.36, 48.20, 16.39, 48.22) where name = 'Dom Museum'),
  'returns coordinates of the venue (public OSM data)'
);
reset role;

-- ---------------------------------------------------------- get_cell_detail ---
select is(public.get_cell_detail('nonsense'), null, 'rejects malformed cells');

set local role anon;
select is(public.get_cell_detail('881e15b713fffff') -> 'live', 'null'::jsonb, 'live is null under k');
select is(public.get_cell_detail('881e15b713fffff') ->> 'label', 'Stephansplatz', 'label comes from the nearest place');
select is(
  public.get_cell_detail('881e15b713fffff') -> 'venues' -> 0 ->> 'name', 'Dom Museum',
  'venues are listed most prominent first'
);
select is(
  jsonb_array_length(public.get_cell_detail('881e15b713fffff') -> 'venues'), 2,
  'seed venues are not listed'
);
select is(
  (public.get_cell_detail('881e15b713fffff') -> 'usual' ->> 'weeks')::int, 0,
  'no history yet'
);
reset role;

-- Live row.
insert into public.live_cells (cell, region, devices, level, trend, label, category)
values ('881e15b713fffff', '851e15b7fffffff', 25, 3, 1, 'Stephansplatz', 'sights');
select is(
  public.get_cell_detail('881e15b713fffff') -> 'live' ->> 'devices', '25', 'live row is included'
);

-- Two weeks of history: still not enough.
insert into public.snapshot_runs (hour_start, samples)
select date_trunc('hour', now()) - (w * interval '7 days'), 4 from generate_series(1, 4) w;
insert into public.cell_hourly (cell, hour_start, devices_sum, samples)
select '881e15b713fffff', date_trunc('hour', now()) - (w * interval '7 days'), 40, 4 from generate_series(1, 2) w;
select is(
  jsonb_array_length(public.get_cell_detail('881e15b713fffff', 'Europe/Vienna') -> 'usual' -> 'hours'), 0,
  'fewer than 3 weeks of history: no chart'
);

-- Third week: the chart appears. Same weekday/hour 4 times: 10, 10, 10 and one hour below k (0).
insert into public.cell_hourly (cell, hour_start, devices_sum, samples)
values ('881e15b713fffff', date_trunc('hour', now()) - interval '21 days', 40, 4);
select is(
  (select (e ->> 'v')::numeric from jsonb_array_elements(
     public.get_cell_detail('881e15b713fffff', 'Europe/Vienna') -> 'usual' -> 'hours') e),
  7.5, 'typical value averages snapshots and counts hours under k as 0'
);
select is(
  public.get_cell_detail('881e15b713fffff', 'Not/AZone') -> 'usual' -> 'hours' -> 0 ->> 'h',
  extract(hour from date_trunc('hour', now()) at time zone 'UTC')::text,
  'unknown time zones fall back to UTC'
);

select * from finish();
rollback;
