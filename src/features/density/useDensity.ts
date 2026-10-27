import { gridDisk, latLngToCell } from 'h3-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createStore } from '@/lib/createStore';
import { isBackendConfigured, supabase } from '@/lib/supabase';
import { levelFromRank } from '@shared/levels.ts';
import { REGION_RESOLUTION, type Category, type LivePlace, type Trend } from '@shared/types.ts';

import { buildMockPlaces } from './mockVienna';

/**
 * Live k-anonymous places around the map centre.
 *
 * Live: reads live_venues for the ~7 regions (H3 resolution 5, ~8 km) around
 * the centre, then applies Realtime broadcasts ("region:<id>") as they come.
 * A heartbeat ("pulse:tick") drives the "updated Xs ago" label. Re-reads on
 * foreground and every 5 minutes as a safety net.
 *
 * Simulated: the prototype's mock Vienna data. Development builds only
 * (toggle in "What's sent"), or when no backend is configured.
 */

const SAFETY_REFRESH_MS = 5 * 60_000;
const MOCK_REFRESH_MS = 30_000;

export const simulatedFeedStore = createStore<boolean>(__DEV__ && !isBackendConfigured);

/**
 * Whether to show simulated data. Never true in a release build: there, a
 * missing backend shows the honest empty / offline state instead.
 */
export function useSimulatedFeed(): boolean {
  const toggled = simulatedFeedStore.use();
  return __DEV__ && (toggled || !isBackendConfigured);
}

export interface DensitySnapshot {
  places: LivePlace[];
  /** Time of the last aggregation run we know of (ms since epoch). */
  updatedAt: number | null;
  source: 'mock' | 'live';
  /** The last attempt to load live data failed (network or server). */
  offline: boolean;
}

/** A live_venues row, or one upsert of a Realtime broadcast (which names the id `id`). */
interface Row {
  venue_id?: number;
  id?: number;
  name: string;
  category: string;
  kind: string | null;
  lng: number;
  lat: number;
  devices: number;
  level: number;
  trend: number;
  updated_at?: string;
}

function toLivePlace(r: Row, at: string): LivePlace {
  return {
    id: (r.venue_id ?? r.id)!,
    name: r.name,
    category: r.category as Category,
    kind: r.kind,
    lng: r.lng,
    lat: r.lat,
    devices: r.devices,
    level: levelFromRank(r.level),
    trend: Math.sign(r.trend) as Trend,
    updatedAt: r.updated_at ?? at,
  };
}

/** Regions (res 5) covering the area around a point: the centre one and its ring. */
export function regionsAround(lat: number, lng: number): string[] {
  return gridDisk(latLngToCell(lat, lng, REGION_RESOLUTION), 1).sort();
}

export function useDensity(center: { lat: number; lng: number }): DensitySnapshot {
  const simulated = useSimulatedFeed();
  const regionKey = regionsAround(center.lat, center.lng).join(',');
  const live = useLivePlaces(simulated ? null : regionKey);
  const mock = useMockPlaces(simulated);
  return simulated ? mock : live;
}

function useMockPlaces(enabled: boolean): DensitySnapshot {
  const [snapshot, setSnapshot] = useState<DensitySnapshot>(() => ({
    places: buildMockPlaces(),
    updatedAt: Date.now(),
    source: 'mock',
    offline: false,
  }));
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(
      () =>
        setSnapshot({
          places: buildMockPlaces(),
          updatedAt: Date.now(),
          source: 'mock',
          offline: false,
        }),
      MOCK_REFRESH_MS,
    );
    return () => clearInterval(id);
  }, [enabled]);
  return snapshot;
}

function useLivePlaces(regionKey: string | null): DensitySnapshot {
  const [byId, setById] = useState<Map<number, LivePlace>>(new Map());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const regionsRef = useRef<string[]>([]);

  useEffect(() => {
    const client = supabase;
    if (!client || !regionKey) return;
    const regions = regionKey.split(',');
    regionsRef.current = regions;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await client
        .from('live_venues')
        .select('venue_id, name, category, kind, lng, lat, devices, level, trend, updated_at')
        .in('region', regions);
      if (cancelled) return;
      setOffline(Boolean(error) || !data);
      if (error || !data) return;
      const now = new Date().toISOString();
      const next = new Map<number, LivePlace>();
      let newest = 0;
      for (const r of data as Row[]) {
        const p = toLivePlace(r, now);
        next.set(p.id, p);
        if (r.updated_at) newest = Math.max(newest, Date.parse(r.updated_at));
      }
      setById(next);
      setUpdatedAt((prev) => Math.max(prev ?? 0, newest) || Date.now());
    };

    load();

    const channels = regions.map((region) =>
      client
        .channel(`region:${region}`, { config: { private: false } })
        .on('broadcast', { event: 'places' }, ({ payload }) => {
          const {
            upserts = [],
            removed = [],
            at,
          } = payload as {
            upserts?: Row[];
            removed?: number[];
            at?: string;
          };
          setById((prev) => {
            const next = new Map(prev);
            for (const id of removed) next.delete(id);
            for (const r of upserts) {
              const p = toLivePlace(r, at ?? new Date().toISOString());
              next.set(p.id, p);
            }
            return next;
          });
          if (at) setUpdatedAt(Date.parse(at));
        })
        .subscribe(),
    );
    const tick = client
      .channel('pulse:tick', { config: { private: false } })
      .on('broadcast', { event: 'tick' }, ({ payload }) => {
        const at = (payload as { at?: string }).at;
        if (at) setUpdatedAt(Date.parse(at));
      })
      .subscribe();

    const safety = setInterval(load, SAFETY_REFRESH_MS);
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });

    return () => {
      cancelled = true;
      clearInterval(safety);
      appState.remove();
      for (const ch of [...channels, tick]) client.removeChannel(ch);
    };
  }, [regionKey]);

  const places = useMemo(() => [...byId.values()].sort((a, b) => b.devices - a.devices), [byId]);
  // No backend configured (a misconfigured release build) reads as offline.
  return { places, updatedAt, source: 'live', offline: offline || !supabase };
}
