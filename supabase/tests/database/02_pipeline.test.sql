-- Intake, k-anonymity, rounding, levels, trend, labels, broadcast, history.
begin;
select plan(27);

-- 30 anonymous users, created an hour ago.
insert into auth.users (id, is_anonymous, created_at)
select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, true, now() - interval '1 hour'
from generate_series(1, 30) i;
create temp table u as
select i, ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid as id from generate_series(1, 30) i;

-- --------------------------------------------------------------- intake ---
select is(
  public.record_ping((select id from u where i = 1), '881e15b713fffff', '851e15b7fffffff', 16.374698, 48.210355),
  'ok', 'a valid ping is accepted'
);
select is(
  public.record_ping((select id from u where i = 1), '881e15b713fffff', '851e15b7fffffff', 16.374698, 48.210355),
  'rate_limited', 'a second ping within 60 s is rejected'
);
select is(
  public.record_ping(gen_random_uuid(), '881e15b713fffff', '851e15b7fffffff', 16.374698, 48.210355),
  'unknown_user', 'unknown users are rejected'
);
select is(
  public.record_ping((select id from u where i = 2), '881e15b713fffff', '851e15b7fffffff', 16.374698, 48.210355,
                     interval '60 seconds', interval '2 hours'),
  'too_new', 'identities younger than the minimum age are rejected'
);
select throws_ok(
  $$select public.record_ping((select id from u where i = 3), 'not-a-cell', '851e15b7fffffff', 16.37, 48.21)$$,
  '23514', null, 'malformed cell ids are rejected by the schema'
);
select throws_ok(
  $$select public.record_ping((select id from u where i = 3), '891e15b713fffff', '851e15b7fffffff', 16.37, 48.21)$$,
  '23514', null, 'cells at other resolutions are rejected'
);
select is((select count(*)::int from public.pings), 1, 'only the accepted ping was stored');
select is(
  (select extensions.st_astext(center::extensions.geometry) from public.cells where cell = '881e15b713fffff'),
  'POINT(16.374698 48.210355)', 'the cell centre is stored, nothing else'
);

-- ----------------------------------------------------------- k-anonymity ---
-- 4 devices in total: below k, nothing is published.
insert into public.pings (user_id, cell) select id, '881e15b713fffff' from u where i between 2 and 4;
select public.refresh_live_cells();
select is((select count(*)::int from public.live_cells), 0, '4 devices: the cell stays hidden');

-- Repeated pings from the same device do not count twice.
insert into public.pings (user_id, cell, created_at)
select id, '881e15b713fffff', now() - interval '5 minutes' from u where i between 1 and 4;
select public.refresh_live_cells();
select is((select count(*)::int from public.live_cells), 0, 'repeat pings from 4 devices still stay hidden');

-- The 5th distinct device publishes the cell.
insert into public.pings (user_id, cell) select id, '881e15b713fffff' from u where i = 5;
select public.refresh_live_cells();
select results_eq(
  'select devices, level::int from public.live_cells',
  $$values (5, 1)$$, '5 devices: published as ~5, Quiet'
);
select is(
  (select count(*)::int from realtime.messages where topic = 'region:851e15b7fffffff' and event = 'cells'),
  1, 'the change is broadcast on the region topic'
);
select ok(
  (select payload -> 'upserts' -> 0 ->> 'cell' = '881e15b713fffff' and not private
   from realtime.messages where topic = 'region:851e15b7fffffff' order by inserted_at desc limit 1),
  'the broadcast carries the cell and is public'
);
select ok(
  exists (select 1 from realtime.messages where topic = 'pulse:tick'),
  'every run sends a heartbeat'
);

-- Rounding and levels.
insert into public.pings (user_id, cell) select id, '881e15b713fffff' from u where i between 6 and 12;
select public.refresh_live_cells();
select results_eq('select devices, level::int from public.live_cells', $$values (10, 2)$$,
  '12 devices: ~10, Moderate');
insert into public.pings (user_id, cell) select id, '881e15b713fffff' from u where i between 13 and 23;
select public.refresh_live_cells();
select results_eq('select devices, level::int from public.live_cells', $$values (25, 3)$$,
  '23 devices: ~25, Busy');

-- No change, no broadcast.
delete from realtime.messages;
select public.refresh_live_cells();
select is(
  (select count(*)::int from realtime.messages where event = 'cells'),
  0, 'an unchanged cell is not re-broadcast'
);

-- ---------------------------------------------------- labels, category ---
insert into public.places (name, geom, source, source_id) values
  ('Stephansplatz', extensions.st_geogfromtext('SRID=4326;POINT(16.3738 48.2082)'), 'test', 'p1'),
  ('Far away', extensions.st_geogfromtext('SRID=4326;POINT(16.30 48.25)'), 'test', 'p2');
insert into public.venues (name, category, geom, cell, source, source_id) values
  ('Bar A', 'nightlife', extensions.st_geogfromtext('SRID=4326;POINT(16.3745 48.2100)'), '881e15b713fffff', 'test', 'v1'),
  ('Bar B', 'nightlife', extensions.st_geogfromtext('SRID=4326;POINT(16.3750 48.2105)'), '881e15b713fffff', 'test', 'v2'),
  ('Museum', 'sights', extensions.st_geogfromtext('SRID=4326;POINT(16.3748 48.2101)'), '881e15b713fffff', 'test', 'v3');
select public.refresh_live_cells();
select results_eq('select label, category from public.live_cells',
  $$values ('Stephansplatz'::text, 'nightlife'::text)$$,
  'label is the nearest place; category is the most common venue type');

-- ------------------------------------------------------------------ trend ---
-- Second cell: 5 devices only in the older half, 10 more only in the newer half.
select is(
  public.record_ping((select id from u where i = 24), '881e15b711fffff', '851e15b7fffffff', 16.362598, 48.212562),
  'ok', 'a ping into a second cell is accepted'
);
insert into public.pings (user_id, cell, created_at)
select id, '881e15b711fffff', now() - interval '12 minutes' from u where i between 25 and 29;
insert into public.pings (user_id, cell, created_at)
select id, '881e15b711fffff', now() - interval '2 minutes' from u where i between 1 and 10;
select public.refresh_live_cells();
select is((select trend::int from public.live_cells where cell = '881e15b711fffff'), 1,
  'more devices in the newer half: trending up');

-- ------------------------------------------------------- falling below k ---
delete from public.pings where cell = '881e15b711fffff' and user_id in (select id from u where i <= 26);
select public.refresh_live_cells();
select is((select count(*)::int from public.live_cells where cell = '881e15b711fffff'), 0,
  'dropping below 5 devices removes the cell');
select ok(
  (select payload -> 'removed' ? '881e15b711fffff' from realtime.messages
   where event = 'cells' order by inserted_at desc limit 1),
  'the removal is broadcast'
);

-- ----------------------------------------------------------------- history ---
select public.snapshot_hourly();
select public.snapshot_hourly();
select results_eq(
  $$select h.devices_sum, h.samples::int, r.samples::int from public.cell_hourly h
    join public.snapshot_runs r using (hour_start) where h.cell = '881e15b713fffff'$$,
  $$values (50, 2, 2)$$, 'snapshots accumulate k-anonymous counts per hour'
);
select ok(
  not exists (select 1 from public.cell_hourly where cell = '881e15b711fffff'),
  'hidden cells leave no history'
);

-- --------------------------------------------------------------- retention ---
insert into public.pings (user_id, cell, created_at)
select id, '881e15b713fffff', now() - interval '21 minutes' from u where i = 30;
select is(public.purge_expired_pings(), 1, 'pings older than 20 minutes are deleted');

insert into auth.users (id, is_anonymous, created_at)
values ('99999999-9999-9999-9999-999999999999', true, now() - interval '26 hours');
insert into public.pings (user_id, cell) values ('99999999-9999-9999-9999-999999999999', '881e15b713fffff');
insert into public.consent_records (user_id, purpose, granted, policy_version)
values ('99999999-9999-9999-9999-999999999999', 'location', true, 'v1');
select public.purge_retention();
select ok(
  not exists (select 1 from auth.users where id = '99999999-9999-9999-9999-999999999999')
  and not exists (select 1 from public.pings where user_id = '99999999-9999-9999-9999-999999999999')
  and not exists (select 1 from public.consent_records where user_id = '99999999-9999-9999-9999-999999999999'),
  'identities older than 25 h are deleted with everything linked to them'
);

select throws_ok(
  $$insert into public.live_cells (cell, region, devices, level) values ('881e15b715fffff', '851e15b7fffffff', 4, 1)$$,
  '23514', null, 'live_cells cannot hold a count below k, even by mistake'
);

select * from finish();
rollback;
