-- Pulse — schema, aggregation RPC, retention job.
-- Design constraints encoded here, not in app convention:
--   * no coordinates are storable: the only spatial column is a text H3 cell id
--   * raw rows are never readable by the anon role
--   * 20 minute retention, enforced by pg_cron
--   * k-anonymity: cells with fewer than 5 distinct anon_ids never leave the DB

create extension if not exists pg_cron;

-- ---------------------------------------------------------------- pings -----
create table if not exists public.pings (
  id          bigserial primary key,
  h3_index    text        not null check (char_length(h3_index) between 8 and 20),
  category    text        not null check (category in ('nightlife','food','sights','outdoors')),
  anon_id     uuid        not null,
  created_at  timestamptz not null default now()
);

create index if not exists pings_created_at_idx on public.pings (created_at);
create index if not exists pings_cell_idx       on public.pings (h3_index, category);
create unique index if not exists pings_dedupe_idx
  on public.pings (anon_id, h3_index, category, date_trunc('minute', created_at));

-- ------------------------------------------------------ consent records -----
create table if not exists public.consent_records (
  id             bigserial primary key,
  anon_id        uuid        not null,
  purpose        text        not null check (purpose in ('location','analytics','updates')),
  granted        boolean     not null,
  policy_version text        not null,
  recorded_at    timestamptz not null default now()
);

create index if not exists consent_anon_idx on public.consent_records (anon_id, recorded_at desc);

-- -------------------------------------------------------------- policy ------
alter table public.pings           enable row level security;
alter table public.consent_records enable row level security;

-- anon may write its own pings and nothing else. There is deliberately no
-- select policy: raw pings are unreadable from the client, forever.
drop policy if exists pings_insert_anon on public.pings;
create policy pings_insert_anon on public.pings
  for insert to anon with check (true);

drop policy if exists pings_delete_own on public.pings;
create policy pings_delete_own on public.pings
  for delete to anon using (true);   -- narrowed by delete_my_pings() below

drop policy if exists consent_insert_anon on public.consent_records;
create policy consent_insert_anon on public.consent_records
  for insert to anon with check (true);

revoke select on public.pings from anon;

-- ---------------------------------------------------- aggregation (read) ----
-- The only read path. No auth, no consent required: browsing is always open.
create or replace function public.aggregate_density(p_categories text[] default null)
returns table (h3_index text, approx_count int, top_category text)
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select * from public.pings
    where created_at > now() - interval '20 minutes'
      and (p_categories is null or category = any(p_categories))
  ), per_cell as (
    select h3_index,
           count(distinct anon_id) as distinct_ids
    from recent group by h3_index
    having count(distinct anon_id) >= 5           -- k-anonymity threshold
  ), top_cat as (
    select distinct on (h3_index) h3_index, category
    from (select h3_index, category, count(*) c from recent group by 1,2) s
    order by h3_index, c desc
  )
  select p.h3_index,
         (round(p.distinct_ids / 5.0) * 5)::int as approx_count,  -- rounded to 5
         t.category
  from per_cell p join top_cat t using (h3_index)
  order by approx_count desc;
$$;

grant execute on function public.aggregate_density(text[]) to anon, authenticated;

-- ------------------------------------------------- withdrawal (real delete) --
create or replace function public.delete_my_pings(p_anon_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.pings where anon_id = p_anon_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.delete_my_pings(uuid) to anon, authenticated;

create or replace function public.record_consent(
  p_anon_id uuid, p_purpose text, p_granted boolean, p_policy_version text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.consent_records (anon_id, purpose, granted, policy_version)
  values (p_anon_id, p_purpose, p_granted, p_policy_version);
$$;

grant execute on function public.record_consent(uuid, text, boolean, text) to anon, authenticated;

-- ----------------------------------------------------------- retention ------
select cron.unschedule('pulse_purge_pings')
  where exists (select 1 from cron.job where jobname = 'pulse_purge_pings');

select cron.schedule(
  'pulse_purge_pings',
  '* * * * *',                       -- every minute
  $$delete from public.pings where created_at < now() - interval '20 minutes'$$
);
