import { cellToBoundary, cellToChildren, latLngToCell } from 'h3-js';

import type { OsmElement } from '../../supabase/functions/_shared/osm/classify.ts';
import {
  cellBbox,
  importRegion,
  type ImportDeps,
  type PlaceDbRow,
  type VenueDbRow,
} from '../../supabase/functions/_shared/osm/importRegion.ts';

const h3 = { latLngToCell, cellToChildren, cellToBoundary };
const VIENNA = latLngToCell(48.2104, 16.3655, 5);

/** A fake Overpass: answers with whatever lies inside the asked bbox. */
const elements: (OsmElement & { lat: number; lon: number })[] = [
  {
    type: 'node',
    id: 1,
    lat: 48.2104,
    lon: 16.3655,
    tags: { amenity: 'cafe', name: 'Café Central' },
  },
  {
    type: 'node',
    id: 2,
    lat: 48.2033,
    lon: 16.3527,
    tags: { place: 'neighbourhood', name: 'Spittelberg' },
  },
  // Far away: another region, must not be imported here.
  { type: 'node', id: 3, lat: 47.07, lon: 15.44, tags: { amenity: 'bar', name: 'Graz Bar' } },
];
function fakeOverpass(query: string): Promise<{ elements?: OsmElement[] }> {
  const [s, w, n, e] = query
    .match(/\(([\d.,-]+)\);/)![1]!
    .split(',')
    .map(Number) as number[];
  return Promise.resolve({
    elements: elements.filter((el) => el.lat >= s! && el.lat <= n! && el.lon >= w! && el.lon <= e!),
  });
}

function deps() {
  const venues: VenueDbRow[] = [];
  const places: PlaceDbRow[] = [];
  const pruned: string[] = [];
  const d: ImportDeps = {
    h3,
    timeZone: () => 'Europe/Vienna',
    overpass: jest.fn(fakeOverpass),
    upsertVenues: async (rows) => void venues.push(...rows),
    upsertPlaces: async (rows) => void places.push(...rows),
    prune: async (region) => void pruned.push(region),
  };
  return { d, venues, places, pruned };
}

describe('importRegion', () => {
  it('asks Overpass once per child cell, with a bbox around it', async () => {
    const { d } = deps();
    await importRegion(VIENNA, d);
    expect(d.overpass).toHaveBeenCalledTimes(7);
    const [s, w, n, e] = cellBbox(h3, cellToChildren(VIENNA, 6)[0]!);
    expect(n - s).toBeLessThan(0.15);
    expect(e - w).toBeLessThan(0.2);
  });

  it('keeps only places of this region, with cell, region and time zone', async () => {
    const { d, venues, places, pruned } = deps();
    const result = await importRegion(VIENNA, d);
    const names = [...new Set(venues.map((v) => v.name))];
    expect(names).toEqual(['Café Central']);
    expect(venues[0]).toMatchObject({
      source_id: 'node/1',
      region: VIENNA,
      cell: latLngToCell(48.2104, 16.3655, 8),
      radius_m: 12,
      shape: null,
      tz: 'Europe/Vienna',
    });
    expect(places.map((p) => p.name)).toContain('Spittelberg');
    expect(result).toEqual({ venues: 1, outlines: 0, places: 1 });
    expect(pruned).toEqual([VIENNA]);
  });

  it('does not prune when an Overpass request fails', async () => {
    const { d, pruned } = deps();
    d.overpass = jest.fn().mockRejectedValue(new Error('Overpass returned 504'));
    await expect(importRegion(VIENNA, d)).rejects.toThrow('504');
    expect(pruned).toEqual([]);
  });
});
