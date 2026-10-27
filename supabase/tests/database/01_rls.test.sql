-- Row level security and privileges: what each role can and cannot touch.
begin;
select plan(20);

-- Fixtures (as the table owner).
insert into auth.users (id, is_anonymous, created_at) values
  ('11111111-1111-1111-1111-111111111111', true, now() - interval '1 hour'),
  ('22222222-2222-2222-2222-222222222222', true, now() - interval '1 hour');
insert into public.venues (id, name, category, geom, cell, region, radius_m, source, source_id)
overriding system value values
  (1, 'Café Eins', 'food', extensions.st_geogfromtext('SRID=4326;POINT(16.3655 48.2104)'),
   '881e15b713fffff', '851e15b7fffffff', 20, 'test', 'v1');
insert into public.pings (user_id, venue_id) values ('11111111-1111-1111-1111-111111111111', 1);
insert into public.live_venues (venue_id, region, name, category, lng, lat, devices, level)
values (1, '851e15b7fffffff', 'Café Eins', 'food', 16.3655, 48.2104, 5, 1);
insert into public.venue_hourly (venue_id, hour_start, devices_sum, samples) values (1, date_trunc('hour', now()), 5, 1);

select ok(
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'),
  'RLS is enabled on every public table'
);

-- ---------------------------------------------------------------- anon ---
set local role anon;
select throws_ok('select * from public.pings', '42501', null, 'anon cannot read raw pings');
select throws_ok('select * from public.venue_hourly', '42501', null, 'anon cannot read raw history');
select is((select count(*)::int from public.live_venues), 1, 'anon can read k-anonymous live places');
select throws_ok(
  $$insert into public.live_venues (venue_id, region, name, category, lng, lat, devices, level)
    values (1, '851e15b7fffffff', 'x', 'food', 0, 0, 5, 1)$$,
  '42501', null, 'anon cannot write live places'
);
select is(
  jsonb_array_length(public.venue_shapes('851e15b7fffffff') -> 'circles'), 1,
  'anon can download place outlines (public data)'
);
select throws_ok(
  $$insert into public.consent_records (user_id, purpose, granted, policy_version)
    values ('11111111-1111-1111-1111-111111111111', 'location', true, 'v1')$$,
  '42501', null, 'anon cannot record consent'
);
select throws_ok(
  $$select public.record_ping('11111111-1111-1111-1111-111111111111', 1)$$,
  '42501', null, 'anon cannot call record_ping'
);
select throws_ok('select public.refresh_live_venues()', '42501', null, 'anon cannot run aggregation');
select throws_ok('select public.delete_my_pings()', '42501', null, 'anon has no delete RPC');
reset role;

-- ------------------------------------------------------ authenticated ---
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok('select * from public.pings', '42501', null, 'signed-in users cannot read raw pings either');
select lives_ok(
  $$insert into public.consent_records (purpose, granted, policy_version) values ('location', true, '2026-10-28')$$,
  'a user can record their own consent'
);
select throws_ok(
  $$insert into public.consent_records (user_id, purpose, granted, policy_version)
    values ('22222222-2222-2222-2222-222222222222', 'location', true, 'v1')$$,
  '42501', null, 'a user cannot record consent for someone else'
);
select throws_ok(
  $$update public.consent_records set granted = false$$,
  '42501', null, 'consent records are append-only'
);
select is(public.my_outstanding_pings(), 1, 'my_outstanding_pings counts own pings');
select throws_ok(
  $$select public.record_ping('11111111-1111-1111-1111-111111111111', 1)$$,
  '42501', null, 'clients cannot bypass the Edge Function'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.consent_records), 0, 'users cannot see each other''s consent');
select is(public.my_outstanding_pings(), 0, 'outstanding count is per user');
select is(public.delete_my_pings(), 0, 'delete_my_pings cannot touch another user''s pings');
reset role;

select is((select count(*)::int from public.pings), 1, 'the other user''s ping is untouched');

select * from finish();
rollback;
