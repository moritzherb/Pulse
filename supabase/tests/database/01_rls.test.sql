-- Row level security and privileges: what each role can and cannot touch.
begin;
select plan(20);

-- Fixtures (as the table owner).
insert into auth.users (id, is_anonymous, created_at) values
  ('11111111-1111-1111-1111-111111111111', true, now() - interval '1 hour'),
  ('22222222-2222-2222-2222-222222222222', true, now() - interval '1 hour');
insert into public.cells (cell, region, center) values
  ('881e15b713fffff', '851e15b7fffffff', extensions.st_geogfromtext('SRID=4326;POINT(16.374698 48.210355)'));
insert into public.pings (user_id, cell) values ('11111111-1111-1111-1111-111111111111', '881e15b713fffff');
insert into public.live_cells (cell, region, devices, level) values ('881e15b713fffff', '851e15b7fffffff', 5, 1);
insert into public.cell_hourly (cell, hour_start, devices_sum, samples) values ('881e15b713fffff', date_trunc('hour', now()), 5, 1);

select ok(
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'),
  'RLS is enabled on every public table'
);

-- ---------------------------------------------------------------- anon ---
set local role anon;
select throws_ok('select * from public.pings', '42501', null, 'anon cannot read raw pings');
select throws_ok('select * from public.cells', '42501', null, 'anon cannot read cell metadata');
select throws_ok('select * from public.cell_hourly', '42501', null, 'anon cannot read raw history');
select is((select count(*)::int from public.live_cells), 1, 'anon can read k-anonymous live cells');
select throws_ok(
  $$insert into public.live_cells (cell, region, devices, level) values ('881e15b711fffff', '851e15b7fffffff', 5, 1)$$,
  '42501', null, 'anon cannot write live cells'
);
select throws_ok(
  $$insert into public.consent_records (user_id, purpose, granted, policy_version)
    values ('11111111-1111-1111-1111-111111111111', 'location', true, 'v1')$$,
  '42501', null, 'anon cannot record consent'
);
select throws_ok(
  $$select public.record_ping('11111111-1111-1111-1111-111111111111', '881e15b713fffff', '851e15b7fffffff', 16.37, 48.21)$$,
  '42501', null, 'anon cannot call record_ping'
);
select throws_ok('select public.refresh_live_cells()', '42501', null, 'anon cannot run aggregation');
select throws_ok('select public.delete_my_pings()', '42501', null, 'anon has no delete RPC');
reset role;

-- ------------------------------------------------------ authenticated ---
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok('select * from public.pings', '42501', null, 'signed-in users cannot read raw pings either');
select lives_ok(
  $$insert into public.consent_records (purpose, granted, policy_version) values ('location', true, '2026-10-27')$$,
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
  $$select public.record_ping('11111111-1111-1111-1111-111111111111', '881e15b713fffff', '851e15b7fffffff', 16.37, 48.21)$$,
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
