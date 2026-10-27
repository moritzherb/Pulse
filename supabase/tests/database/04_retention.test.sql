-- Retention status check.
begin;
select plan(9);

set local role anon;
select throws_ok('select public.retention_status()', '42501', null, 'anon cannot read retention status');
reset role;
set local role authenticated;
select throws_ok('select public.retention_status()', '42501', null, 'app users cannot read retention status');
reset role;

insert into auth.users (id, is_anonymous, created_at) values
  ('11111111-1111-1111-1111-111111111111', true, now() - interval '1 hour'),
  ('22222222-2222-2222-2222-222222222222', true, now() - interval '30 hours');
insert into public.venues (id, name, category, geom, cell, region, radius_m, source, source_id)
overriding system value values
  (1, 'Café Eins', 'food', extensions.st_geogfromtext('SRID=4326;POINT(16.3655 48.2104)'),
   '881e15b713fffff', '851e15b7fffffff', 20, 'test', 'v1');
insert into public.pings (user_id, venue_id, created_at) values
  ('11111111-1111-1111-1111-111111111111', 1, now() - interval '5 minutes');

select is((public.retention_status() ->> 'pings')::int, 1, 'counts raw pings');
select is((public.retention_status() ->> 'oldest_ping_minutes')::numeric, 5.0, 'reports the oldest ping age');
select is((public.retention_status() ->> 'anonymous_users_over_25h')::int, 1, 'reports identities past 25 h');
select is(
  jsonb_array_length(public.retention_status() -> 'jobs'), 5,
  'lists the five Pulse cron jobs'
);

insert into auth.audit_log_entries (ip_address, created_at) values
  ('203.0.113.7', now() - interval '26 hours'),
  ('203.0.113.8', now() - interval '1 hour');
select is(public.audit_log_oldest_hours(), 26.0, 'reports the oldest auth audit entry');

select public.purge_retention();
select is((public.retention_status() ->> 'anonymous_users_over_25h')::int, 0, 'purge_retention clears them');
select is(
  (select count(*)::int from auth.audit_log_entries), 1,
  'auth audit entries (with IP addresses) older than 25 h are deleted'
);

select * from finish();
rollback;
