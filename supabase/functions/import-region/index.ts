/**
 * POST /functions/v1/import-region   { "region": "851e15b7fffffff" }
 *
 * Makes sure the public places of one region (H3 resolution 5, ~250 km²)
 * are imported from OpenStreetMap, so Pulse works anywhere in the world.
 * Called by the app when a phone needs the place outlines of its region, or
 * when someone looks at a region at street zoom. Carries nothing about the
 * caller: only the region, which is public geography.
 *
 * Responses
 *   200 { status: "ready" }       imported within the last 30 days
 *   202 { status: "importing" }   an import is running (started now or earlier);
 *                                 ask venue_shapes() again in a minute or two
 *   400 { error: "invalid_region" }
 *   429 { status: "limited" }     too many imports this hour; try later
 *
 * The import runs in the background after the response, with one request
 * per child cell to the public Overpass API (set OVERPASS_URL to use your
 * own server). Data © OpenStreetMap contributors, ODbL.
 */
import tzLookup from 'npm:@photostructure/tz-lookup@11';
import {
  cellToBoundary,
  cellToChildren,
  getResolution,
  isValidCell,
  latLngToCell,
} from 'npm:h3-js@4';

import { json, numberEnv } from '../_shared/http.ts';
import { importRegion, overpassClient, REGION_RES } from '../_shared/osm/importRegion.ts';
import { adminClient } from '../_shared/supabase.ts';

/** Regions started per hour, across everyone. Keeps Pulse a polite Overpass user. */
const MAX_PER_HOUR = numberEnv('IMPORT_MAX_PER_HOUR', 30);
const OVERPASS_URL = Deno.env.get('OVERPASS_URL') ?? 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'Pulse-region-import/1.0 (crowd levels for public places)';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

async function run(region: string): Promise<void> {
  const db = adminClient();
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
      overpass: overpassClient(OVERPASS_URL, USER_AGENT),
      upsertVenues: async (rows, at) => {
        const { error } = await db.rpc('upsert_osm_venues', { p_rows: rows, p_imported_at: at });
        if (error) throw new Error(`upsert_osm_venues: ${error.code}`);
      },
      upsertPlaces: async (rows, at) => {
        const { error } = await db.rpc('upsert_osm_places', { p_rows: rows, p_imported_at: at });
        if (error) throw new Error(`upsert_osm_places: ${error.code}`);
      },
      prune: async (r, before) => {
        const { error } = await db.rpc('prune_osm_region', {
          p_region: r,
          p_imported_before: before,
        });
        if (error) throw new Error(`prune_osm_region: ${error.code}`);
      },
    });
    await db.rpc('finish_region_import', { p_region: region, p_ok: true, p_venues: result.venues });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('import failed', region, message);
    await db.rpc('finish_region_import', { p_region: region, p_ok: false, p_error: message });
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let region: unknown;
  try {
    region = ((await req.json()) as { region?: unknown })?.region;
  } catch {
    return json({ error: 'invalid_region' }, 400);
  }
  if (typeof region !== 'string' || !isValidCell(region) || getResolution(region) !== REGION_RES) {
    return json({ error: 'invalid_region' }, 400);
  }

  const { data, error } = await adminClient().rpc('claim_region_import', {
    p_region: region,
    p_max_per_hour: MAX_PER_HOUR,
  });
  if (error) {
    console.error('claim_region_import failed', error.code);
    return json({ error: 'server_error' }, 500);
  }

  switch (data as string) {
    case 'fresh':
      return json({ status: 'ready' });
    case 'busy':
      return json({ status: 'importing' }, 202);
    case 'limited':
      return json({ status: 'limited' }, 429);
    default: {
      const job = run(region);
      // Keep working after the response; locally (no EdgeRuntime) just wait.
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(job);
      else await job;
      return json({ status: 'importing' }, 202);
    }
  }
});
