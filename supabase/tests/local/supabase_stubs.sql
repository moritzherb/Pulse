-- Minimal stand-ins for the parts of Supabase the migrations depend on, so the
-- schema and pgTAP tests can run against a plain Postgres + PostGIS + pg_cron.
-- Used ONLY by supabase/tests/local/run.sh. Never applied to a real project.

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists realtime;

do $$
begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;
do $$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;
do $$
begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end $$;

grant usage on schema public, extensions, auth to anon, authenticated, service_role;

-- Supabase default: API roles get table privileges on new public tables.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  is_anonymous       boolean not null default false,
  created_at         timestamptz not null default now(),
  raw_app_meta_data  jsonb not null default '{}'::jsonb
);

-- Same contract as Supabase: the subject of the current request's JWT.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- realtime.send() writes to realtime.messages, like the real implementation.
create table if not exists realtime.messages (
  topic        text not null,
  extension    text not null default 'broadcast',
  event        text,
  payload      jsonb,
  private      boolean default true,
  inserted_at  timestamptz not null default clock_timestamp()
);
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$
  insert into realtime.messages (topic, event, payload, private) values (topic, event, payload, private)
$$;
