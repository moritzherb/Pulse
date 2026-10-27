/**
 * Import the public places of one region (H3 resolution 5, ~250 km²) from
 * OpenStreetMap. Shared by the `import-region` Edge Function (on demand,
 * anywhere in the world) and scripts/import-osm.ts (ahead of time).
 *
 * Plain TypeScript with every dependency injected (H3, time zones, Overpass,
 * database), so it runs under Deno, Node and Jest alike.
 *
 * The region is fetched as its 7 child cells (resolution 6, ~36 km² each),
 * one Overpass request at a time: smaller answers, gentler on the public
 * Overpass servers. Only places whose own region is this one are kept; the
 * neighbours get theirs when they are imported.
 */
import { overpassQuery, parseOverpass, shapeWkt, type OsmElement } from './classify.ts';

export interface H3Functions {
  latLngToCell(lat: number, lng: number, res: number): string;
  cellToChildren(cell: string, res: number): string[];
  /** Boundary as [lat, lng] pairs (h3-js default order). */
  cellToBoundary(cell: string): number[][];
}

/** A venue row as public.upsert_osm_venues() takes it. */
export interface VenueDbRow {
  source_id: string;
  name: string;
  category: string;
  kind: string;
  rank: number;
  lng: number;
  lat: number;
  cell: string;
  region: string;
  shape: string | null;
  radius_m: number | null;
  area_m2: number;
  tz: string | null;
}

/** A place-name row as public.upsert_osm_places() takes it. */
export interface PlaceDbRow {
  source_id: string;
  name: string;
  kind: string;
  lng: number;
  lat: number;
  region: string;
}

export interface ImportDeps {
  h3: H3Functions;
  /** IANA time zone at a position, or null when unknown. */
  timeZone(lat: number, lng: number): string | null;
  /** Run one Overpass QL query. */
  overpass(query: string): Promise<{ elements?: OsmElement[] }>;
  upsertVenues(rows: VenueDbRow[], importedAt: string): Promise<void>;
  upsertPlaces(rows: PlaceDbRow[], importedAt: string): Promise<void>;
  /** Remove OSM rows of the region that this import did not see (closed, renamed). */
  prune(region: string, importedBefore: string): Promise<void>;
  log?(message: string): void;
}

export interface ImportResult {
  venues: number;
  outlines: number;
  places: number;
}

export const REGION_RES = 5;
const CHILD_RES = 6;
const CELL_RES = 8;
const CHUNK = 500;

/** Bounding box (south, west, north, east) of a cell, padded by ~100 m. */
export function cellBbox(h3: H3Functions, cell: string): [number, number, number, number] {
  const pts = h3.cellToBoundary(cell);
  const lats = pts.map((p) => p[0]!);
  const lngs = pts.map((p) => p[1]!);
  const pad = 0.001;
  return [
    Math.min(...lats) - pad,
    Math.min(...lngs) - pad,
    Math.max(...lats) + pad,
    Math.max(...lngs) + pad,
  ];
}

export async function importRegion(region: string, deps: ImportDeps): Promise<ImportResult> {
  const { h3 } = deps;
  const importedAt = new Date().toISOString();
  const seenVenues = new Set<string>();
  const seenOutlines = new Set<string>();
  const seenPlaces = new Set<string>();

  // Written part by part, so a long import that gets cut off keeps what it
  // has; the region is only marked done (and pruned) once every part is in.
  const children = h3.cellToChildren(region, CHILD_RES);
  for (const [i, child] of children.entries()) {
    const parsed = parseOverpass(await deps.overpass(overpassQuery(cellBbox(h3, child))));

    const venueRows: VenueDbRow[] = [];
    for (const v of parsed.venues) {
      if (h3.latLngToCell(v.lat, v.lng, REGION_RES) !== region) continue;
      const shape = shapeWkt(v.shape);
      seenVenues.add(v.sourceId);
      if (shape) seenOutlines.add(v.sourceId);
      venueRows.push({
        source_id: v.sourceId,
        name: v.name,
        category: v.category,
        kind: v.kind,
        rank: v.rank,
        lng: v.lng,
        lat: v.lat,
        cell: h3.latLngToCell(v.lat, v.lng, CELL_RES),
        region,
        shape,
        radius_m: v.shape.type === 'circle' ? v.shape.radiusM : null,
        area_m2: Math.max(1, Math.round(v.areaM2)),
        tz: deps.timeZone(v.lat, v.lng),
      });
    }
    const placeRows: PlaceDbRow[] = [];
    for (const p of parsed.places) {
      if (h3.latLngToCell(p.lat, p.lng, REGION_RES) !== region) continue;
      seenPlaces.add(p.sourceId);
      placeRows.push({
        source_id: p.sourceId,
        name: p.name,
        kind: p.kind,
        lng: p.lng,
        lat: p.lat,
        region,
      });
    }

    for (let j = 0; j < venueRows.length; j += CHUNK) {
      await deps.upsertVenues(venueRows.slice(j, j + CHUNK), importedAt);
    }
    for (let j = 0; j < placeRows.length; j += CHUNK) {
      await deps.upsertPlaces(placeRows.slice(j, j + CHUNK), importedAt);
    }
    deps.log?.(`${region}: part ${i + 1}/${children.length}, ${seenVenues.size} places so far`);
  }

  await deps.prune(region, importedAt);
  return { venues: seenVenues.size, outlines: seenOutlines.size, places: seenPlaces.size };
}

/**
 * A polite Overpass client: identifies itself, waits and retries when the
 * server is busy (429, 504), gives up after a few tries.
 */
export function overpassClient(
  endpoint: string,
  userAgent: string,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): ImportDeps['overpass'] {
  return async (query) => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent },
        body: new URLSearchParams({ data: query }),
      });
      if (res.ok) return (await res.json()) as { elements?: OsmElement[] };
      if ((res.status === 429 || res.status === 504) && attempt < 3) {
        await wait(15_000 * (attempt + 1));
        continue;
      }
      throw new Error(`Overpass returned ${res.status}`);
    }
  };
}
