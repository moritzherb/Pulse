import { mockShapes } from '@/features/density/mockVienna';
import { readJson, StorageKeys, writeJson } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import { buildPlaceIndex, type PlaceIndex, type ShapesPayload } from './placeIndex';

/**
 * Place outlines for the region the phone is in, so it can tell which place
 * it is at without sending its position anywhere.
 *
 * Downloaded from venue_shapes() (public OpenStreetMap data) the first time
 * sharing needs them, kept on the phone for a week, then refreshed. The
 * request names only the region (~250 km²). Without a backend (development),
 * the simulated Vienna places stand in.
 */

const MAX_AGE_MS = 7 * 24 * 3_600_000;

interface Stored {
  region: string;
  fetchedAt: number;
  payload: ShapesPayload;
}

const memory = new Map<string, PlaceIndex>();
const loading = new Map<string, Promise<PlaceIndex | null>>();

/** Outlines already on the phone, or null. Synchronous: safe to call inside the privacy boundary. */
export function cachedPlaceIndex(region: string): PlaceIndex | null {
  const hit = memory.get(region);
  if (hit) return hit;
  if (!supabase) {
    const index = buildPlaceIndex({ ...mockShapes(), region });
    memory.set(region, index);
    return index;
  }
  const stored = readJson<Stored | null>(StorageKeys.placeShapes, null);
  if (stored?.region === region && Date.now() - stored.fetchedAt < MAX_AGE_MS) {
    const index = buildPlaceIndex(stored.payload);
    memory.set(region, index);
    return index;
  }
  return null;
}

/** Make sure the outlines for a region are on the phone. Resolves null when offline. */
export function loadPlaceIndex(region: string): Promise<PlaceIndex | null> {
  const cached = cachedPlaceIndex(region);
  if (cached) return Promise.resolve(cached);
  const pending = loading.get(region);
  if (pending) return pending;

  const client = supabase;
  if (!client) return Promise.resolve(null);
  const job = (async () => {
    const { data, error } = await client.rpc('venue_shapes', { p_region: region });
    if (error || !data) return null;
    const payload = data as ShapesPayload;
    // One region at a time: the phone keeps only where it is.
    writeJson(StorageKeys.placeShapes, { region, fetchedAt: Date.now(), payload } satisfies Stored);
    const index = buildPlaceIndex(payload);
    memory.clear();
    memory.set(region, index);
    return index;
  })().finally(() => loading.delete(region));
  loading.set(region, job);
  return job;
}
