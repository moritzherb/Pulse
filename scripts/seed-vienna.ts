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
 *   - places, venues  one place per hotspot and one venue per seeded cell, source = 'seed',
 *                     venue names end in "(simulated)"
 *   - cell_hourly     k-anonymous hourly history, with snapshot_runs
 *
 * Live mode writes raw pings and then runs public.refresh_live_cells(), so the
 * real aggregation, k-anonymity and Realtime broadcast are exercised end to end.
 * Uses a direct Postgres connection (Supabase: Settings -> Database -> Connection
 * string). Never point it at a production project.
 */
import { cellToLatLng, cellToParent, gridDisk, latLngToCell } from 'h3-js';
import postgres from 'postgres';

import { K_ANONYMITY } from '../supabase/functions/_shared/levels.ts';
import { H3_RESOLUTION, REGION_RESOLUTION } from '../supabase/functions/_shared/types.ts';

import { FALLOFF, hash01, HOTSPOTS, rhythm, type Hotspot } from './seed/vienna.ts';

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

interface ModelCell {
  cell: string;
  region: string;
  lng: number;
  lat: number;
  /** Hotspot contributing most to this cell: names the place and the venue. */
  main: Hotspot;
  parts: { spot: Hotspot; share: number }[];
  /** Upper bound of devices this cell can need, used to size the pool. */
  capacity: number;
}

function buildModel(): ModelCell[] {
  const byCell = new Map<string, { parts: { spot: Hotspot; share: number }[] }>();
  for (const spot of HOTSPOTS) {
    const centre = latLngToCell(spot.lat, spot.lng, H3_RESOLUTION);
    const seen = new Set<string>();
    FALLOFF.forEach((share, ring) => {
      for (const cell of gridDisk(centre, ring)) {
        if (seen.has(cell)) continue;
        seen.add(cell);
        const jitter = 0.8 + 0.4 * hash01(cell + spot.name);
        const entry = byCell.get(cell) ?? { parts: [] };
        entry.parts.push({ spot, share: share * jitter });
        byCell.set(cell, entry);
      }
    });
  }
  return [...byCell].map(([cell, { parts }]) => {
    const [lat, lng] = cellToLatLng(cell);
    const main = parts.reduce((a, b) =>
      b.spot.peak * b.share > a.spot.peak * a.share ? b : a,
    ).spot;
    const model = {
      cell,
      region: cellToParent(cell, REGION_RESOLUTION),
      lng,
      lat,
      main,
      parts,
      capacity: 0,
    };
    model.capacity = weeklyMax(model);
    return model;
  });
}

/** Most devices the cell ever needs in a week (15-minute steps), plus noise headroom. */
function weeklyMax(c: ModelCell): number {
  const monday = Date.UTC(2026, 0, 5); // any full week works
  let max = 0;
  for (let t = monday; t < monday + 7 * 86_400_000; t += 15 * 60_000) {
    const at = new Date(t);
    max = Math.max(
      max,
      c.parts.reduce((s, p) => s + p.spot.peak * p.share * rhythm(p.spot.category, at), 0),
    );
  }
  return Math.ceil(max * 1.12) + 1;
}

/** Expected distinct devices in a cell at a moment. */
function expected(c: ModelCell, at: Date): number {
  // Noise that changes every 5 minutes, stable within that slot.
  const slot = Math.floor(at.getTime() / 300_000);
  const noise = 0.88 + 0.24 * hash01(`${c.cell}:${slot}`);
  const base = c.parts.reduce((s, p) => s + p.spot.peak * p.share * rhythm(p.spot.category, at), 0);
  return Math.max(0, Math.round(base * noise));
}

const roundToFive = (n: number) => Math.max(K_ANONYMITY, Math.round(n / 5) * 5);

// -------------------------------------------------------------- database ---

async function assertSchema() {
  const [row] = await sql<{ ok: boolean }[]>`select to_regclass('public.pings') is not null as ok`;
  if (!row?.ok) throw new Error('Pulse schema not found. Apply supabase/migrations first.');
}

async function reset() {
  const users = await sql`
    delete from auth.users where raw_app_meta_data ->> 'synthetic' = 'true' returning id`;
  const venues = await sql`delete from public.venues where source = 'seed' returning id`;
  const places = await sql`delete from public.places where source = 'seed' returning id`;
  const cells = buildModel().map((c) => c.cell);
  const history =
    await sql`delete from public.cell_hourly where cell = any(${cells}) returning cell`;
  await sql`select public.refresh_live_cells()`;
  console.log(
    `Removed ${users.length} synthetic users, ${venues.length} venues, ${places.length} places, ` +
      `${history.length} history rows.`,
  );
}

async function seedStatic(model: ModelCell[]) {
  const cellRows = model.map((c) => ({
    cell: c.cell,
    region: c.region,
    center: `SRID=4326;POINT(${c.lng} ${c.lat})`,
  }));
  await sql`
    insert into public.cells ${sql(cellRows, 'cell', 'region', 'center')}
    on conflict (cell) do nothing`;

  const places = HOTSPOTS.map((h) => ({
    name: h.name,
    kind: 'area',
    geom: `SRID=4326;POINT(${h.lng} ${h.lat})`,
    source: 'seed',
    source_id: h.name,
  }));
  await sql`
    insert into public.places ${sql(places, 'name', 'kind', 'geom', 'source', 'source_id')}
    on conflict (source, source_id) do update set name = excluded.name, geom = excluded.geom`;

  const venues = model.map((c) => ({
    name: `${c.main.name} (simulated)`,
    category: c.main.category,
    geom: `SRID=4326;POINT(${c.lng} ${c.lat})`,
    cell: c.cell,
    source: 'seed',
    source_id: c.cell,
  }));
  await sql`
    insert into public.venues ${sql(venues, 'name', 'category', 'geom', 'cell', 'source', 'source_id')}
    on conflict (source, source_id) do update set name = excluded.name, category = excluded.category`;

  console.log(`Seeded ${model.length} cells, ${places.length} places, ${venues.length} venues.`);
}

/**
 * Hourly history, built exactly like snapshot_hourly(): four 15-minute
 * snapshots per hour, each already k-anonymous and rounded to 5.
 */
async function seedHistory(model: ModelCell[], days: number) {
  if (days <= 0) return;
  const lastHour = new Date();
  lastHour.setUTCMinutes(0, 0, 0);
  const start = new Date(lastHour.getTime() - days * 24 * 3_600_000);

  const runs: { hour_start: Date; samples: number }[] = [];
  let rows: { cell: string; hour_start: Date; devices_sum: number; samples: number }[] = [];
  let written = 0;

  const flush = async () => {
    if (!rows.length) return;
    await sql`
      insert into public.cell_hourly ${sql(rows, 'cell', 'hour_start', 'devices_sum', 'samples')}
      on conflict (cell, hour_start) do update set
        devices_sum = excluded.devices_sum, samples = excluded.samples`;
    written += rows.length;
    rows = [];
  };

  for (let t = start.getTime(); t < lastHour.getTime(); t += 3_600_000) {
    const hourStart = new Date(t);
    runs.push({ hour_start: hourStart, samples: 4 });
    for (const c of model) {
      let sum = 0;
      for (let q = 0; q < 4; q++) {
        const v = expected(c, new Date(t + q * 15 * 60_000));
        if (v >= K_ANONYMITY) sum += roundToFive(v);
      }
      if (sum > 0) rows.push({ cell: c.cell, hour_start: hourStart, devices_sum: sum, samples: 4 });
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
  console.log(`Backfilled ${days} days of history: ${written} cell-hours.`);
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
 * One minute of simulated activity. Each cell owns a fixed slice of the
 * pool; the first `target` users of the slice are "present" and ping every
 * 3 minutes, staggered. On the first tick the last 15 minutes are backfilled
 * so the map fills immediately.
 */
async function liveTick(model: ModelCell[], pool: string[], tick: number, backfill: boolean) {
  const now = new Date();
  const rows: { user_id: string; cell: string; created_at: Date }[] = [];
  let offset = 0;
  for (const c of model) {
    const target = Math.min(expected(c, now), c.capacity);
    for (let j = 0; j < target; j++) {
      const user = pool[offset + j];
      if (!user) break;
      if (backfill) {
        // Recreate the last 15 minutes: every present device pinged every 3
        // minutes, staggered, so both halves of the window see it (steady trend).
        for (let m = j % PING_EVERY_TICKS; m < 15; m += PING_EVERY_TICKS) {
          rows.push({
            user_id: user,
            cell: c.cell,
            created_at: new Date(now.getTime() - m * 60_000),
          });
        }
      } else if ((tick + j) % PING_EVERY_TICKS === 0) {
        rows.push({ user_id: user, cell: c.cell, created_at: now });
      }
    }
    offset += c.capacity;
  }
  for (let i = 0; i < rows.length; i += 2000) {
    const chunk = rows.slice(i, i + 2000);
    await sql`insert into public.pings ${sql(chunk, 'user_id', 'cell', 'created_at')}`;
  }
  await sql`select public.refresh_live_cells()`;
  const [live] = await sql<{ n: number; busy: number }[]>`
    select count(*)::int as n, count(*) filter (where level >= 3)::int as busy from public.live_cells`;
  const clock = now.toLocaleTimeString('de-AT', {
    timeZone: 'Europe/Vienna',
    hour: '2-digit',
    minute: '2-digit',
  });
  console.log(
    `${clock} Vienna · ${rows.length} pings · ${live?.n ?? 0} live cells (${live?.busy ?? 0} busy or packed)`,
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

  const model = buildModel();
  await seedStatic(model);
  await seedHistory(model, HISTORY_DAYS);

  if (!LIVE) {
    console.log('Done. Run again with --live to stream simulated devices.');
    return;
  }

  const poolSize = model.reduce((s, c) => s + c.capacity, 0);
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
