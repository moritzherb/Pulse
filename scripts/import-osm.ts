/**
 * Import public places from OpenStreetMap ahead of time, region by region.
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/import-osm.ts [options]
 *
 *   --city <names>      Comma-separated cities from src/data/cities.ts (default: Vienna).
 *                       Imports the city's region and the ring around it.
 *   --region <ids>      Comma-separated H3 resolution-5 regions instead
 *   --ring <n>          Rings of neighbouring regions around each city (default 1)
 *   --force             Re-import regions imported in the last 30 days
 *   --endpoint <url>    Overpass endpoint (default https://overpass-api.de/api/interpreter)
 *   --yes               Required when DATABASE_URL is not a local database
 *
 * Anywhere else, the app imports a region on demand the first time it is
 * needed (Edge Function `import-region`); both use the same code
 * (supabase/functions/_shared/osm/importRegion.ts) and the same database
 * functions. Venue ids stay the same across imports. Data © OpenStreetMap
 * contributors, ODbL.
 */
import tzLookup from '@photostructure/tz-lookup';
import { cellToBoundary, cellToChildren, gridDisk, latLngToCell } from 'h3-js';
import postgres from 'postgres';

import {
  importRegion,
  overpassClient,
  REGION_RES,
} from '../supabase/functions/_shared/osm/importRegion.ts';
import { CITIES } from '../src/data/cities.ts';

const argv = process.argv.slice(2);
const arg = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to a Postgres connection string.');
  process.exit(1);
}
const host = new URL(url).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1', ''].includes(host);
if (!isLocal && !argv.includes('--yes')) {
  console.error(`Refusing to write to ${host} without --yes.`);
  process.exit(1);
}

/** The regions to import, from --region or --city. */
function regionsToImport(): string[] {
  const explicit = list(arg('region'));
  if (explicit.length > 0) return explicit;
  const ring = Number(arg('ring') ?? 1);
  const names = list(arg('city'));
  const regions = new Set<string>();
  for (const name of names.length > 0 ? names : ['Vienna']) {
    const city = CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!city) throw new Error(`Unknown city "${name}". See src/data/cities.ts.`);
    for (const r of gridDisk(latLngToCell(city.lat, city.lng, REGION_RES), ring)) regions.add(r);
  }
  return [...regions];
}

async function main() {
  const regions = regionsToImport();
  const force = argv.includes('--force');
  const overpass = overpassClient(
    arg('endpoint') ?? 'https://overpass-api.de/api/interpreter',
    'Pulse-import/1.0 (crowd levels for public places)',
  );
  const sql = postgres(url!, { prepare: false, onnotice: () => {}, max: 2 });
  console.log(`Importing ${regions.length} region(s); each takes a minute or two.`);

  try {
    for (const region of regions) {
      const [claim] = await sql<{ status: string }[]>`
        select public.claim_region_import(${region}, 1000000,
          ${force ? '0 seconds' : '30 days'}::interval) as status`;
      if (claim?.status !== 'claimed') {
        console.log(
          `${region}: ${claim?.status === 'fresh' ? 'imported recently, skipped (use --force)' : claim?.status}`,
        );
        continue;
      }
      try {
        const result = await importRegion(region, {
          h3: { latLngToCell, cellToChildren, cellToBoundary },
          timeZone: (lat, lng) => {
            try {
              return tzLookup(lat, lng);
            } catch {
              return null;
            }
          },
          overpass,
          upsertVenues: async (rows, at) => {
            await sql`select public.upsert_osm_venues(${sql.json(rows as never)}, ${at})`;
          },
          upsertPlaces: async (rows, at) => {
            await sql`select public.upsert_osm_places(${sql.json(rows as never)}, ${at})`;
          },
          prune: async (r, before) => {
            await sql`select public.prune_osm_region(${r}, ${before})`;
          },
          log: (m) => console.log(m),
        });
        await sql`select public.finish_region_import(${region}, true, ${result.venues})`;
        // Real places replace the stand-ins the seed script adds where none exist.
        await sql`delete from public.venues where source = 'seed' and region = ${region}`;
        console.log(
          `${region}: ${result.venues} places (${result.outlines} with outlines), ${result.places} place names.`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await sql`select public.finish_region_import(${region}, false, null, ${message})`;
        throw err;
      }
    }
    // Update names and categories of live places right away.
    await sql`select public.refresh_live_venues()`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
