import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { nearestCity } from '@/data/cities';
import { supabase } from '@/lib/supabase';
import { levelFromRank } from '@shared/levels.ts';
import type { LivePlace } from '@shared/types.ts';

import { buildMockPlaces } from './mockVienna';
import { useSimulatedFeed } from './useDensity';

/** Below this zoom the map shows the world overview instead of single places. */
export const OVERVIEW_ZOOM = 9;
const REFRESH_MS = 60_000;

/**
 * Busy areas worldwide, for zoomed-out maps: one entry per region with live
 * places (live_overview()), shaped like a place so the heatmap and the
 * "Busiest now" list can show it. Ids are negative, names are the nearest
 * city, `kind` says how many places are live there. Only fetched while
 * `active`.
 */
export function useOverview(active: boolean): LivePlace[] {
  const simulated = useSimulatedFeed();
  const [areas, setAreas] = useState<LivePlace[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const load = async () => {
      if (simulated) {
        if (!cancelled) setAreas(summarise(buildMockPlaces()));
        return;
      }
      if (!supabase) return;
      const { data, error } = await supabase.rpc('live_overview');
      if (cancelled || error || !Array.isArray(data)) return;
      setAreas(
        (data as Row[]).map((r, i) =>
          toArea(i, r.lng, r.lat, r.places, r.devices, levelFromRank(r.level)),
        ),
      );
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [active, simulated]);

  return active ? areas : [];
}

interface Row {
  region: string;
  lng: number;
  lat: number;
  places: number;
  devices: number;
  level: number;
}

function toArea(
  i: number,
  lng: number,
  lat: number,
  places: number,
  devices: number,
  level: LivePlace['level'],
): LivePlace {
  return {
    id: -1 - i,
    name: nearestCity(lat, lng).name,
    category: 'sights',
    kind: `${places} ${places === 1 ? 'place' : 'places'}`,
    lng,
    lat,
    devices,
    level,
    trend: 0,
    updatedAt: new Date().toISOString(),
  };
}

const RANK = { quiet: 1, moderate: 2, busy: 3, packed: 4 } as const;

/** The simulated feed as one Vienna area, like live_overview() would return it. */
export function summarise(places: LivePlace[]): LivePlace[] {
  if (places.length === 0) return [];
  const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
  const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
  const devices = places.reduce((s, p) => s + p.devices, 0);
  const top = places.reduce((a, b) => (RANK[b.level] > RANK[a.level] ? b : a)).level;
  return [toArea(0, lng, lat, places.length, devices, top)];
}
