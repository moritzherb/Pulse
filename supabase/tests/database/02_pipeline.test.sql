-- Intake, k-anonymity, rounding, levels, trend, broadcast, history, retention.
begin;
select plan(27);

-- 30 anonymous users, created an hour ago.
insert into auth.users (id, is_anonymous, created_at)
select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, true, now() - interval '1 hour'
from generate_series(1, 30) i;
create temp table u as
select i, ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid as id from generate_series(1, 30) i;

-- Two places: a café drawn as a point, a park with an outline. One venue
-- without a region (imported before outlines existed) cannot receive pings.
insert into public.venues (id, name, category, kind, rank, geom, cell, region, radius_m, area_m2, source, source_id)
overriding system value values
  (1, 'Café Central', 'food', 'café', 2, extensions.st_geogfromtext('SRID=4326;POINT(16.3655 48.2104)'),
   '881e15b713fffff', '851e15b7fffffff', 20, 1257, 'test', 'v1');
insert into public.venues (id, name, category, kind, rank, geom, cell, region, shape, area_m2, source, source_id)
overriding system value values
  (2, 'Volksgarten', 'outdoors', 'park', 3, extensions.st_geogfromtext('SRID=4326;POINT(16.3620 48.2080)'),
   '881e15b711fffff', '851e15b7fffffff',
   extensions.st_geogfromtext('SRID=4326;MULTIPOLYGON(((16.360 48.207,16.364 48.207,16.364 48.209,16.360 48.209,16.360 48.207)))'),
   65000, 'test', 'v2');
insert into public.venues (id, name, category, geom, cell, radius_m, source, source_id)
overriding system value values
  (3, 'Old row', 'food', extensions.st_geogfromtext('SRID=4326;POINT(16.37 48.21)'), '881e15b713fffff', 20, 'test', 'v3');

-- --------------------------------------------------------------- intake ---
select is(public.record_ping((select id from u where i = 1), 1), 'ok', 'a valid ping is accepted');
select is(public.record_ping((select id from u where i = 1), 1), 'rate_limited', 'a second ping within 60 s is rejected');
select is(public.record_ping(gen_random_uuid(), 1), 'unknown_user', 'unknown users are rejected');
select is(public.record_ping((select id from u where i = 2), 999), 'unknown_venue', 'unknown places are rejected');
select is(public.record_ping((select id from u where i = 2), 3), 'unknown_venue', 'places without a region are rejected');
select is(
  public.record_ping((select id from u where i = 2), 1, interval '60 seconds', interval '2 hours'),
  'too_new', 'identities younger than the minimum age are rejected'
);
select is((select count(*)::int from public.pings), 1, 'only the accepted ping was stored');
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.columns
   where table_schema = 'public' and table_name = 'pings'),
  array['created_at', 'id', 'user_id', 'venue_id'], 'a ping holds a place id, never a position'
);

-- ----------------------------------------------------------- k-anonymity ---
insert into public.pings (user_id, venue_id) select id, 1 from u where i between 2 and 4;
select public.refresh_live_venues();
select is((select count(*)::int from public.live_venues), 0, '4 devices: the place stays hidden');

insert into public.pings (user_id, venue_id, created_at)
select id, 1, now() - interval '5 minutes' from u where i between 1 and 4;
select public.refresh_live_venues();
select is((select count(*)::int from public.live_venues), 0, 'repeat pings from 4 devices still stay hidden');

insert into public.pings (user_id, venue_id) select id, 1 from u where i = 5;
select public.refresh_live_venues();
select results_eq(
  'select devices, level::int, name, category from public.live_venues',
  $$values (5, 1, 'Café Central'::text, 'food'::text)$$, '5 devices: published as ~5, Quiet, with its name'
);
select is(
  (select count(*)::int from realtime.messages where topic = 'region:851e15b7fffffff' and event = 'places'),
  1, 'the change is broadcast on the region topic'
);
select ok(
  (select (payload -> 'upserts' -> 0 ->> 'id')::int = 1 and not private
   from realtime.messages where topic = 'region:851e15b7fffffff' order by inserted_at desc limit 1),
  'the broadcast carries the place and is public'
);
select ok(exists (select 1 from realtime.messages where topic = 'pulse:tick'), 'every run sends a heartbeat');

-- Rounding and fixed levels (no history yet).
insert into public.pings (user_id, venue_id) select id, 1 from u where i between 6 and 12;
select public.refresh_live_venues();
select results_eq('select devices, level::int from public.live_venues', $$values (10, 2)$$, '12 devices: ~10, Moderate');
insert into public.pings (user_id, venue_id) select id, 1 from u where i between 13 and 23;
select public.refresh_live_venues();
select results_eq('select devices, level::int from public.live_venues', $$values (25, 3)$$, '23 devices: ~25, Busy');

delete from realtime.messages;
select public.refresh_live_venues();
select is((select count(*)::int from realtime.messages where event = 'places'), 0, 'an unchanged place is not re-broadcast');

-- ---------------------------------------------------- level vs usual peak ---
-- A place that usually peaks at 25 is Packed at ~25; one that peaks at 100 is Quiet.
update public.venues set usual_peak = 25 where id = 1;
select public.refresh_live_venues();
select is((select level::int from public.live_venues where venue_id = 1), 4, 'at its usual peak, a place is Packed');
update public.venues set usual_peak = 100 where id = 1;
select public.refresh_live_venues();
select is((select level::int from public.live_venues where venue_id = 1), 1, 'far below its usual peak, a place is Quiet');
select is(public.level_for_place(25, null), 3::smallint, 'without history the fixed thresholds apply');

-- ------------------------------------------------------------------ trend ---
insert into public.pings (user_id, venue_id, created_at)
select id, 2, now() - interval '12 minutes' from u where i between 25 and 29;
insert into public.pings (user_id, venue_id, created_at)
select id, 2, now() - interval '2 minutes' from u where i between 1 and 10;
select public.refresh_live_venues();
select is((select trend::int from public.live_venues where venue_id = 2), 1, 'more devices in the newer half: trending up');

-- ------------------------------------------------------- falling below k ---
delete from public.pings where venue_id = 2 and user_id in (select id from u where i <= 26);
select public.refresh_live_venues();
select is((select count(*)::int from public.live_venues where venue_id = 2), 0, 'dropping below 5 devices removes the place');
select ok(
  (select payload -> 'removed' @> '[2]'::jsonb from realtime.messages
   where event = 'places' order by inserted_at desc limit 1),
  'the removal is broadcast'
);

-- ----------------------------------------------------------------- history ---
select public.snapshot_hourly();
select public.snapshot_hourly();
select results_eq(
  $$select h.devices_sum, h.samples::int, r.samples::int from public.venue_hourly h
    join public.snapshot_runs r using (hour_start) where h.venue_id = 1$$,
  $$values (50, 2, 2)$$, 'snapshots accumulate k-anonymous counts per hour'
);

-- Usual peak: 3 weeks of the same hour at ~20 devices.
update public.venues set usual_peak = null;
insert into public.snapshot_runs (hour_start, samples)
select date_trunc('hour', now()) - w * interval '7 days', 4 from generate_series(1, 3) w;
insert into public.venue_hourly (venue_id, hour_start, devices_sum, samples)
select 1, date_trunc('hour', now()) - w * interval '7 days', 80, 4 from generate_series(1, 3) w;
select public.refresh_usual_peaks();
select ok((select usual_peak between 20 and 22 from public.venues where id = 1),
  'usual peak is the busiest typical hour');

-- --------------------------------------------------------------- retention ---
insert into public.pings (user_id, venue_id, created_at)
select id, 1, now() - interval '21 minutes' from u where i = 30;
select is(public.purge_expired_pings(), 1, 'pings older than 20 minutes are deleted');

select throws_ok(
  $$insert into public.live_venues (venue_id, region, name, category, lng, lat, devices, level)
    values (2, '851e15b7fffffff', 'x', 'food', 0, 0, 4, 1)$$,
  '23514', null, 'live_venues cannot hold a count below k, even by mistake'
);

select * from finish();
rollback;
