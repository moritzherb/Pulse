import { useEffect, useState } from 'react';

import { latLngToCell } from 'h3-js';

import { mockVenues } from '@/features/density/mockVienna';
import { useSimulatedFeed } from '@/features/density/useDensity';
import { requestRegionImport } from '@/features/places/regionImport';
import { supabase } from '@/lib/supabase';
import { REGION_RESOLUTION, type Category } from '@shared/types.ts';

export interface VenuePin {
  id: number;
  name: string;
  category: Category;
  kind: string | null;
  lng: number;
  lat: number;
}

/** Pins are drawn from this zoom on (street level). */
export const VENUE_MIN_ZOOM = 14.5;
const DEBOUNCE_MS = 300;
const LIMIT = 200;
/** After asking for a region's import, look for its places again this much later. */
const IMPORT_RECHECK_MS = 90_000;

type Bounds = [west: number, south: number, east: number, north: number];

/**
 * Places in view at street zoom, most prominent first, so quiet places can
 * be tapped too. Public OpenStreetMap data via venues_in_bbox(). Simulated
 * feed: the simulated places, as pins.
 *
 * Looking at a region at street zoom also asks the server to import its
 * places if nobody has before, so the map fills in anywhere in the world.
 */
export function useVenues(bounds: Bounds | null, zoom: number): VenuePin[] {
  const simulated = useSimulatedFeed();
  const [pins, setPins] = useState<VenuePin[]>([]);
  const [recheck, setRecheck] = useState(0);
  const visible = zoom >= VENUE_MIN_ZOOM && bounds !== null;
  // Round so tiny pans don't refetch.
  const key = visible ? bounds.map((n) => n.toFixed(3)).join(',') : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let later: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(async () => {
      if (simulated) {
        if (!cancelled) setPins(mockVenues());
        return;
      }
      if (!supabase) return;
      const [west, south, east, north] = key.split(',').map(Number) as Bounds;
      const { data, error } = await supabase.rpc('venues_in_bbox', {
        p_west: west,
        p_south: south,
        p_east: east,
        p_north: north,
        p_limit: LIMIT,
      });
      if (!cancelled && !error && Array.isArray(data)) setPins(data as VenuePin[]);

      const region = latLngToCell((south + north) / 2, (west + east) / 2, REGION_RESOLUTION);
      const state = await requestRegionImport(region);
      if (!cancelled && state === 'importing') {
        later = setTimeout(() => setRecheck((n) => n + 1), IMPORT_RECHECK_MS);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearTimeout(later);
    };
  }, [key, simulated, recheck]);

  return visible ? pins : [];
}
