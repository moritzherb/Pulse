/**
 * Import venues and place names for Vienna from OpenStreetMap.
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/import-osm.ts [options]
 *
 *   --from <file.json>  Use a saved Overpass response instead of downloading
 *   --save <file.json>  Save the downloaded Overpass response
 *   --endpoint <url>    Overpass endpoint (default https://overpass-api.de/api/interpreter)
 *   --yes               Required when DATABASE_URL is not a local database
 *
 * Upserts venues and places with source = 'osm', then removes OSM rows that
 * were not in this import (closed or renamed venues). Safe to run repeatedly,
 * for example once a week. Data © OpenStreetMap contributors, ODbL.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { latLngToCell } from 'h3-js';
import postgres from 'postgres';

import { H3_RESOLUTION } from '../supabase/functions/_shared/types.ts';

import { overpassQuery, parseOverpass, VIENNA_BBOX, type OsmElement } from './osm/classify.ts';

const argv = process.argv.slice(2);
const arg = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

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

async function download(): Promise<{ elements?: OsmElement[] }> {
  const endpoint = arg('endpoint') ?? 'https://overpass-api.de/api/interpreter';
  console.log(`Querying ${endpoint} (this can take a minute)...`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Pulse-import/1.0',
    },
    body: new URLSearchParams({ data: overpassQuery(VIENNA_BBOX) }),
  });
  if (!res.ok)
    throw new Error(`Overpass returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { elements?: OsmElement[] };
}

async function main() {
  const from = arg('from');
  const json = from ? JSON.parse(readFileSync(from, 'utf8')) : await download();
  const save = arg('save');
  if (save && !from) writeFileSync(save, JSON.stringify(json));

  const { venues, places } = parseOverpass(json);
  console.log(`Parsed ${venues.length} venues and ${places.length} places.`);
  if (venues.length === 0) throw new Error('No venues parsed; refusing to wipe existing data.');

  const sql = postgres(url!, { prepare: false, onnotice: () => {}, max: 2 });
  try {
    const startedAt = new Date();
    await sql.begin(async (tx) => {
      for (let i = 0; i < venues.length; i += 2000) {
        const rows = venues.slice(i, i + 2000).map((v) => ({
          name: v.name,
          category: v.category,
          kind: v.kind,
          rank: v.rank,
          geom: `SRID=4326;POINT(${v.lng} ${v.lat})`,
          cell: latLngToCell(v.lat, v.lng, H3_RESOLUTION),
          source: 'osm',
          source_id: v.sourceId,
          imported_at: startedAt,
        }));
        await tx`
          insert into public.venues ${tx(rows, 'name', 'category', 'kind', 'rank', 'geom', 'cell', 'source', 'source_id', 'imported_at')}
          on conflict (source, source_id) do update set
            name = excluded.name, category = excluded.category, kind = excluded.kind,
            rank = excluded.rank, geom = excluded.geom, cell = excluded.cell,
            imported_at = excluded.imported_at`;
      }
      for (let i = 0; i < places.length; i += 2000) {
        const rows = places.slice(i, i + 2000).map((p) => ({
          name: p.name,
          kind: p.kind,
          geom: `SRID=4326;POINT(${p.lng} ${p.lat})`,
          source: 'osm',
          source_id: p.sourceId,
          imported_at: startedAt,
        }));
        await tx`
          insert into public.places ${tx(rows, 'name', 'kind', 'geom', 'source', 'source_id', 'imported_at')}
          on conflict (source, source_id) do update set
            name = excluded.name, kind = excluded.kind, geom = excluded.geom,
            imported_at = excluded.imported_at`;
      }
      const goneVenues = await tx`
        delete from public.venues where source = 'osm' and imported_at < ${startedAt} returning id`;
      const gonePlaces = await tx`
        delete from public.places where source = 'osm' and imported_at < ${startedAt} returning id`;
      // Real venues replace the simulated ones the seed script adds for categories.
      const seed = await tx`delete from public.venues where source = 'seed' returning id`;
      console.log(
        `Upserted ${venues.length} venues and ${places.length} places; removed ` +
          `${goneVenues.length} closed venues, ${gonePlaces.length} old places, ${seed.length} simulated venues.`,
      );
    });
    // Re-label live cells with the new names and categories right away.
    await sql`select public.refresh_live_cells()`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
