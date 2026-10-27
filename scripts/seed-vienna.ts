/**
 * Simulated Vienna crowd data, for testing Pulse without real users.
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/seed-vienna.ts [options]
 *
 *   --history <days>  Backfill <days> of hourly history for "usually busy at" (default 28, 0 = none)
 *   --live            Keep sending pings from synthetic devices every minute (Ctrl+C to stop)
 *   --reset           Remove all synthetic users, seed places/venues and seeded history, then exit
 *   --yes             Required when DATABASE_URL is not a local database
 *
 * What it writes, and how it is marked so it can never be mistaken for real data:
 *   - auth.users      synthetic anonymous users, raw_app_meta_data.synthetic = true
 *   - pings           from those users only, through the same tables real pings use
 *   - venues          only for simulated places that have no OpenStreetMap match yet
 *                     (scripts/import-osm.ts), with source = 'seed'
 *   - venue_hourly    k-anonymous hourly history, with snapshot_runs, then usual peaks
 *
 * The crowd model (src/features/density/simulation.ts) puts about 50 well-known
 * Vienna places on the map. When OSM places are imported, each simulated place
 * is matched to its real counterpart by name, and 200 more imported places get
 * a smaller simulated crowd, so the whole city has something on it.
 *
 * Live mode writes raw pings and then runs public.refresh_live_venues(), so the
 * real aggregation, k-anonymity, levels and Realtime broadcast are exercised
 * end to end. Uses a direct Postgres connection (Supabase: Connect -> Session
 * pooler). Never point it at a production project.
 */
import { latLngToCell } from 'h3-js';
import postgres from 'postgres';

import { K_ANONYMITY } from '../supabase/functions/_shared/levels.ts';
import { H3_RESOLUTION, REGION_RESOLUTION } from '../supabase/functions/_shared/types.ts';

import { expectedDevices, SIM_VENUES, type Category } from '../src/features/density/simulation.ts';

// ------------------------------------------------------------------ args ---

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const option = (name: string, fallback: number) => {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
};

const HISTORY_DAYS = option('history', 28);
const LIVE = flag('live');
const RESET = flag('reset');
const TICK_MS = 60_000;
/** Each synthetic device pings every 3 minutes, like the app. */
const PING_EVERY_TICKS = 3;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to a Postgres connection string.');
  process.exit(1);
}
const host = new URL(url).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1', ''].includes(host);
if (!isLocal && !flag('yes')) {
  console.error(`Refusing to seed ${host} without --yes. Never seed a production project.`);
  process.exit(1);
}

const sql = postgres(url, { prepare: false, onnotice: () => {}, max: 4 });

// ----------------------------------------------------------------- model ---

/** A place in the database with a simulated crowd. */
interface ModelVenue {
  id: number;
  name: string;
  category: Category;
  /** Devices at the busiest hour of the week. */
  peak: number;
  /** Most devices it ever needs, with noise headroom: its slice of the user pool. */
  capacity: number;
}

/** How many extra imported places get a simulated crowd. */
const EXTRA_PLACES = 200;

/** Typical peak crowd for imported places, by kind. */
const PEAK_BY_KIND: Record<string, number> = {
  restaurant: 10,
  café: 9,
  'fast food': 8,
  bar: 11,
  pub: 11,
  club: 25,
  museum: 20,
  gallery: 8,
  park: 18,
  garden: 10,
  square: 22,
  church: 12,
  market: 20,
  theatre: 18,
  cinema: 15,
};

const roundToFive = (n: number) => Math.max(K_ANONYMITY, Math.round(n / 5) * 5);
const withCapacity = (v: Omit<ModelVenue, 'capacity'>): ModelVenue => ({
  ...v,
  capacity: Math.ceil(v.peak * 1.7 * 1.15) + 1, // night spill x noise
});

/**
 * The simulated places as database rows. With `create`, simulated places that
 * have no OSM match are inserted as seed venues; without it (for --reset),
 * they are only looked up. Deterministic, so --reset finds the same places.
 */
async function buildModel(create: boolean): Promise<ModelVenue[]> {
  const model: ModelVenue[] = [];
  const used = new Set<number>();
  let inserted = 0;

  for (const v of SIM_VENUES) {
    const point = `SRID=4326;POINT(${v.lng} ${v.lat})`;
    const [match] = await sql<{ id: number }[]>`
      select id from public.venues
      where source <> 'seed'
        and (lower(name) = lower(${v.name}) or name ilike ${'%' + v.name + '%'})
        and region is not null
        and extensions.st_dwithin(geom, ${point}::extensions.geography, 400)
      order by lower(name) = lower(${v.name}) desc,
               geom operator(extensions.<->) ${point}::extensions.geography
      limit 1`;
    let id = match?.id;
    if (id === undefined) {
      const [seed] = await sql<{ id: number }[]>`
        select id from public.venues where source = 'seed' and source_id = ${v.name}`;
      id = seed?.id;
    }
    if (id === undefined && create) {
      const [row] = await sql<{ id: number }[]>`
        insert into public.venues
          (name, category, kind, rank, geom, cell, region, radius_m, area_m2, tz, source, source_id)
        values (
          ${v.name}, ${v.category}, ${v.kind}, 2, ${point},
          ${latLngToCell(v.lat, v.lng, H3_RESOLUTION)}, ${latLngToCell(v.lat, v.lng, REGION_RESOLUTION)},
          ${v.radiusM}, ${Math.round(Math.PI * v.radiusM * v.radiusM)}, 'Europe/Vienna', 'seed', ${v.name})
        returning id`;
      id = row!.id;
      inserted += 1;
    }
    if (id === undefined || used.has(id)) continue;
    used.add(id);
    model.push(withCapacity({ id, name: v.name, category: v.category, peak: v.peak }));
  }

  const extras = await sql<
    { id: number; name: string; category: Category; kind: string | null; rank: number }[]
  >`
    select id, name, category, kind, rank from public.venues
    where source = 'osm' and rank > 0 and region is not null and not (id = any(${[...used]}))
    order by rank desc, md5(source_id)
    limit ${EXTRA_PLACES}`;
  for (const e of extras) {
    const base = PEAK_BY_KIND[e.kind ?? ''] ?? 10;
    const peak = Math.round(base * (e.rank === 3 ? 1.6 : e.rank === 2 ? 1.2 : 1));
    model.push(withCapacity({ id: e.id, name: e.name, category: e.category, peak }));
  }

  if (create) {
    console.log(
      `Model: ${model.length} places (${SIM_VENUES.length - inserted} of ${SIM_VENUES.length} ` +
        `simulated places matched to imported ones, ${inserted} added, ${extras.length} extra).`,
    );
  }
  return model;
}

// -------------------------------------------------------------- database ---

async function assertSchema() {
  const [row] = await sql<{ ok: boolean }[]>`
    select to_regclass('public.live_venues') is not null as ok`;
  if (!row?.ok) throw new Error('Pulse schema not found or outdated. Run supabase db push first.');
}

async function reset() {
  const model = await buildModel(false);
  const ids = model.map((m) => m.id);
  const users = await sql`
    delete from auth.users where raw_app_meta_data ->> 'synthetic' = 'true' returning id`;
  const history =
    await sql`delete from public.venue_hourly where venue_id = any(${ids}) returning venue_id`;
  await sql`update public.venues set usual_peak = null where id = any(${ids})`;
  const venues = await sql`delete from public.venues where source = 'seed' returning id`;
  const places = await sql`delete from public.places where source = 'seed' returning id`;
  await sql`select public.refresh_live_venues()`;
  console.log(
    `Removed ${users.length} synthetic users, ${venues.length} seed venues, ${places.length} seed places, ` +
      `${history.length} history rows.`,
  );
}

/**
 * Hourly history, built exactly like snapshot_hourly(): four 15-minute
 * snapshots per hour, each already k-anonymous and rounded to 5. Then the
 * usual peaks, so levels are relative to each place right away.
 */
async function seedHistory(model: ModelVenue[], days: number) {
  if (days <= 0) return;
  const lastHour = new Date();
  lastHour.setUTCMinutes(0, 0, 0);
  const start = new Date(lastHour.getTime() - days * 24 * 3_600_000);

  const runs: { hour_start: Date; samples: number }[] = [];
  let rows: { venue_id: number; hour_start: Date; devices_sum: number; samples: number }[] = [];
  let written = 0;

  const flush = async () => {
    if (!rows.length) return;
    await sql`
      insert into public.venue_hourly ${sql(rows, 'venue_id', 'hour_start', 'devices_sum', 'samples')}
      on conflict (venue_id, hour_start) do update set
        devices_sum = excluded.devices_sum, samples = excluded.samples`;
    written += rows.length;
    rows = [];
  };

  for (let t = start.getTime(); t < lastHour.getTime(); t += 3_600_000) {
    const hourStart = new Date(t);
    runs.push({ hour_start: hourStart, samples: 4 });
    for (const v of model) {
      let sum = 0;
      for (let q = 0; q < 4; q++) {
        const n = expectedDevices(v, new Date(t + q * 15 * 60_000));
        if (n >= K_ANONYMITY) sum += roundToFive(n);
      }
      if (sum > 0)
        rows.push({ venue_id: v.id, hour_start: hourStart, devices_sum: sum, samples: 4 });
    }
    if (rows.length >= 5000) await flush();
  }
  await flush();

  for (let i = 0; i < runs.length; i += 5000) {
    const chunk = runs.slice(i, i + 5000);
    await sql`
      insert into public.snapshot_runs ${sql(chunk, 'hour_start', 'samples')}
      on conflict (hour_start) do update set
        samples = greatest(public.snapshot_runs.samples, excluded.samples)`;
  }
  const [peaks] = await sql<{ n: number }[]>`select public.refresh_usual_peaks() as n`;
  console.log(
    `Backfilled ${days} days of history: ${written} place-hours, ${peaks?.n ?? 0} usual peaks.`,
  );
}

/** Auth columns that GoTrue expects to be '' rather than NULL, when present. */
async function tokenColumns(): Promise<string[]> {
  const wanted = ['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change'];
  const rows = await sql<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = any(${wanted})`;
  return rows.map((r) => r.column_name);
}

/**
 * A pool of synthetic anonymous users. Created an hour in the past so they
 * pass the minimum identity age, and replaced once purge_retention() removes
 * them after 25 h.
 */
async function ensurePool(size: number): Promise<string[]> {
  const existing = await sql<{ id: string }[]>`
    select id from auth.users
    where raw_app_meta_data ->> 'synthetic' = 'true' and created_at > now() - interval '24 hours'
    order by id`;
  const missing = size - existing.length;
  if (missing > 0) {
    const extra = await tokenColumns();
    const rows = Array.from({ length: missing }, () => {
      const row: Record<string, unknown> = {
        id: crypto.randomUUID(),
        is_anonymous: true,
        created_at: new Date(Date.now() - 3_600_000),
        raw_app_meta_data: { provider: 'anonymous', providers: ['anonymous'], synthetic: true },
      };
      for (const col of extra) row[col] = '';
      return row;
    });
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      await sql`insert into auth.users ${sql(chunk as never, Object.keys(chunk[0]!))}`;
    }
    console.log(`Created ${missing} synthetic users.`);
  }
  const all = await sql<{ id: string }[]>`
    select id from auth.users
    where raw_app_meta_data ->> 'synthetic' = 'true' and created_at > now() - interval '24 hours'
    order by id`;
  return all.map((r) => r.id);
}

/**
 * One minute of simulated activity. Each place owns a fixed slice of the
 * pool; the first `target` users of the slice are "present" and ping every
 * 3 minutes, staggered. On the first tick the last 15 minutes are backfilled
 * so the map fills immediately.
 */
async function liveTick(model: ModelVenue[], pool: string[], tick: number, backfill: boolean) {
  const now = new Date();
  const rows: { user_id: string; venue_id: number; created_at: Date }[] = [];
  let offset = 0;
  for (const v of model) {
    const target = Math.min(expectedDevices(v, now), v.capacity);
    for (let j = 0; j < target; j++) {
      const user = pool[offset + j];
      if (!user) break;
      if (backfill) {
        // Recreate the last 15 minutes: every present device pinged every 3
        // minutes, staggered, so both halves of the window see it (steady trend).
        for (let m = j % PING_EVERY_TICKS; m < 15; m += PING_EVERY_TICKS) {
          rows.push({
            user_id: user,
            venue_id: v.id,
            created_at: new Date(now.getTime() - m * 60_000),
          });
        }
      } else if ((tick + j) % PING_EVERY_TICKS === 0) {
        rows.push({ user_id: user, venue_id: v.id, created_at: now });
      }
    }
    offset += v.capacity;
  }
  for (let i = 0; i < rows.length; i += 2000) {
    const chunk = rows.slice(i, i + 2000);
    await sql`insert into public.pings ${sql(chunk, 'user_id', 'venue_id', 'created_at')}`;
  }
  await sql`select public.refresh_live_venues()`;
  const [live] = await sql<{ n: number; busy: number }[]>`
    select count(*)::int as n, count(*) filter (where level >= 3)::int as busy from public.live_venues`;
  const clock = now.toLocaleTimeString('de-AT', {
    timeZone: 'Europe/Vienna',
    hour: '2-digit',
    minute: '2-digit',
  });
  console.log(
    `${clock} Vienna · ${rows.length} pings · ${live?.n ?? 0} live places (${live?.busy ?? 0} busy or packed)`,
  );
}

// ------------------------------------------------------------------ main ---

async function main() {
  await assertSchema();
  console.log(`Seeding ${isLocal ? 'local database' : host}.`);

  if (RESET) {
    await reset();
    return;
  }

  const model = await buildModel(true);
  await seedHistory(model, HISTORY_DAYS);

  if (!LIVE) {
    console.log('Done. Run again with --live to stream simulated devices.');
    return;
  }

  const poolSize = model.reduce((sum, v) => sum + v.capacity, 0);
  let pool = await ensurePool(poolSize);
  let tick = 0;
  await liveTick(model, pool, tick, true);

  let stopped = false;
  process.on('SIGINT', () => {
    stopped = true;
    console.log(
      '\nStopping. Simulated pings expire within 20 minutes; --reset removes everything now.',
    );
  });
  while (!stopped) {
    await new Promise((r) => setTimeout(r, TICK_MS));
    if (stopped) break;
    tick += 1;
    if (tick % 60 === 0) pool = await ensurePool(poolSize); // replace purged users hourly
    await liveTick(model, pool, tick, false);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
