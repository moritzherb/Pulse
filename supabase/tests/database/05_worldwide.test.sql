-- On-demand region imports, OSM upserts and pruning, local time zones.
begin;
select plan(19);

-- ----------------------------------------------------------- privileges ---
set local role anon;
select throws_ok($$select public.claim_region_import('851e15b7fffffff')$$, '42501', null,
  'clients cannot claim imports');
select throws_ok($$select public.upsert_osm_venues('[]'::jsonb, now())$$, '42501', null,
  'clients cannot write places');
select throws_ok('select * from public.region_imports', '42501', null,
  'clients cannot read the import log');
reset role;

-- --------------------------------------------------------------- claims ---
select throws_ok($$select public.claim_region_import('nope')$$, '22023', null, 'malformed regions are refused');
select is(public.claim_region_import('851e15b7fffffff'), 'claimed', 'a new region is claimed');
select is(public.claim_region_import('851e15b7fffffff'), 'busy', 'a running import is not started twice');
select public.finish_region_import('851e15b7fffffff', true, 2);
select is(public.claim_region_import('851e15b7fffffff'), 'fresh', 'a recent import is not repeated');
update public.region_imports set finished_at = now() - interval '31 days';
select is(public.claim_region_import('851e15b7fffffff'), 'claimed', 'an old import is refreshed');
select is(public.claim_region_import('851e15a7fffffff', 1), 'limited', 'the hourly limit protects Overpass');
select public.finish_region_import('851e15b7fffffff', true, 2);

-- -------------------------------------------------------------- upserts ---
select is(public.upsert_osm_venues($$[
  {"source_id": "node/1", "name": "Café Eins", "category": "food", "kind": "café", "rank": 1,
   "lng": 16.3655, "lat": 48.2104, "cell": "881e15b713fffff", "region": "851e15b7fffffff",
   "shape": null, "radius_m": 12, "area_m2": 452, "tz": "Europe/Vienna"},
  {"source_id": "way/2", "name": "Park", "category": "outdoors", "kind": "park", "rank": 3,
   "lng": 16.362, "lat": 48.208, "cell": "881e15b711fffff", "region": "851e15b7fffffff",
   "shape": "SRID=4326;MULTIPOLYGON(((16.360 48.207,16.364 48.207,16.364 48.209,16.360 48.209,16.360 48.207)))",
   "radius_m": null, "area_m2": 65000, "tz": "Europe/Vienna"}
]$$::jsonb, now() - interval '1 day'), 2, 'places are inserted');
select is(
  (select tz from public.venues where source_id = 'node/1'), 'Europe/Vienna', 'with their time zone'
);
select ok(
  (select shape is not null and radius_m is null from public.venues where source_id = 'way/2'),
  'outlines are stored as shapes'
);
select is(public.upsert_osm_places($$[
  {"source_id": "node/9", "name": "Innere Stadt", "kind": "area", "lng": 16.3738, "lat": 48.2082, "region": "851e15b7fffffff"}
]$$::jsonb, now() - interval '1 day'), 1, 'place names are inserted');

-- A later import sees only the café: the park is pruned, ids stay the same.
create temp table before as select id from public.venues where source_id = 'node/1';
select public.upsert_osm_venues($$[
  {"source_id": "node/1", "name": "Café Eins", "category": "food", "kind": "café", "rank": 1,
   "lng": 16.3655, "lat": 48.2104, "cell": "881e15b713fffff", "region": "851e15b7fffffff",
   "shape": null, "radius_m": 12, "area_m2": 452, "tz": "Europe/Vienna"}
]$$::jsonb, now());
select is(public.prune_osm_region('851e15b7fffffff', now()), '{"venues": 1, "places": 1}'::jsonb,
  'what the new import did not see is pruned');
select is((select id from public.venues where source_id = 'node/1'), (select id from before),
  'a re-imported place keeps its id');

-- ---------------------------------------------------------- venue_shapes ---
set local role anon;
select ok((public.venue_shapes('851e15b7fffffff') ->> 'importedAt') is not null,
  'shapes say when the region was imported');
select is(public.venue_shapes('851e15a7fffffff') -> 'importedAt', 'null'::jsonb,
  'and null for a region never imported');
reset role;

-- ------------------------------------------------------ local time zones ---
update public.venues set rank = 1 where source_id = 'node/1';
select is(
  public.get_venue_detail((select id from before), 'America/New_York') -> 'place' ->> 'tz',
  'Europe/Vienna', 'the place''s own time zone wins over the phone''s'
);
update public.venues set tz = null where source_id = 'node/1';
select is(
  public.get_venue_detail((select id from before), 'America/New_York') -> 'place' ->> 'tz',
  'America/New_York', 'without one, the phone''s time zone is used'
);

select * from finish();
rollback;
