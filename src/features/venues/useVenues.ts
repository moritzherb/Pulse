import { useEffect, useState } from 'react';

import { mockVenues } from '@/features/density/mockVienna';
import { useSimulatedFeed } from '@/features/density/useDensity';
import { supabase } from '@/lib/supabase';
import type { Category } from '@shared/types.ts';

export interface VenuePin {
  id: number;
  name: string;
  category: Category;
  kind: string | null;
  lng: number;
  lat: number;
  /** H3 cell of the venue; null for simulated pins (looked up on tap). */
  cell: string | null;
}

/** Pins are drawn from this zoom on (street level). */
export const VENUE_MIN_ZOOM = 14.5;
const DEBOUNCE_MS = 300;
const LIMIT = 200;

type Bounds = [west: number, south: number, east: number, north: number];

/**
 * Venues in view at street zoom, most prominent first. Public OpenStreetMap
 * data via venues_in_bbox(). Simulated feed: the hotspots, as pins.
 */
export function useVenues(bounds: Bounds | null, zoom: number): VenuePin[] {
  const simulated = useSimulatedFeed();
  const [pins, setPins] = useState<VenuePin[]>([]);
  const visible = zoom >= VENUE_MIN_ZOOM && bounds !== null;
  // Round so tiny pans don't refetch.
  const key = visible ? bounds.map((n) => n.toFixed(3)).join(',') : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
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
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key, simulated]);

  return visible ? pins : [];
}
