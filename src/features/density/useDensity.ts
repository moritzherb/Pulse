import { gridDisk, latLngToCell } from 'h3-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createStore } from '@/lib/createStore';
import { isBackendConfigured, supabase } from '@/lib/supabase';
import { levelFromRank } from '@shared/levels.ts';
import { REGION_RESOLUTION, type Category, type LiveCell, type Trend } from '@shared/types.ts';

import { buildMockVienna } from './mockVienna';

/**
 * Live k-anonymous cells around the map centre.
 *
 * Live: reads live_cells for the ~7 regions (H3 resolution 5, ~8 km) around
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
export const useSimulatedFeed = () => simulatedFeedStore.use();

export interface DensitySnapshot {
  cells: LiveCell[];
  /** Time of the last aggregation run we know of (ms since epoch). */
  updatedAt: number | null;
  source: 'mock' | 'live';
}

interface Row {
  cell: string;
  region: string;
  devices: number;
  level: number;
  trend: number;
  label: string | null;
  category: string | null;
  updated_at?: string;
}

function toLiveCell(r: Row, at: string): LiveCell {
  return {
    cell: r.cell,
    devices: r.devices,
    level: levelFromRank(r.level),
    trend: Math.sign(r.trend) as Trend,
    category: (r.category as Category | null) ?? null,
    label: r.label,
    updatedAt: r.updated_at ?? at,
  };
}

/** Regions (res 5) covering the area around a point: the centre one and its ring. */
export function regionsAround(lat: number, lng: number): string[] {
  return gridDisk(latLngToCell(lat, lng, REGION_RESOLUTION), 1).sort();
}

export function useDensity(center: { lat: number; lng: number }): DensitySnapshot {
  const simulated = useSimulatedFeed() || !supabase;
  const regionKey = regionsAround(center.lat, center.lng).join(',');
  const live = useLiveCells(simulated ? null : regionKey);
  const mock = useMockCells(simulated);
  return simulated ? mock : live;
}

function useMockCells(enabled: boolean): DensitySnapshot {
  const [snapshot, setSnapshot] = useState<DensitySnapshot>(() => ({
    cells: buildMockVienna(),
    updatedAt: Date.now(),
    source: 'mock',
  }));
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(
      () => setSnapshot({ cells: buildMockVienna(), updatedAt: Date.now(), source: 'mock' }),
      MOCK_REFRESH_MS,
    );
    return () => clearInterval(id);
  }, [enabled]);
  return snapshot;
}

function useLiveCells(regionKey: string | null): DensitySnapshot {
  const [byCell, setByCell] = useState<Map<string, LiveCell>>(new Map());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const regionsRef = useRef<string[]>([]);

  useEffect(() => {
    const client = supabase;
    if (!client || !regionKey) return;
    const regions = regionKey.split(',');
    regionsRef.current = regions;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await client
        .from('live_cells')
        .select('cell, region, devices, level, trend, label, category, updated_at')
        .in('region', regions);
      if (cancelled || error || !data) return;
      const now = new Date().toISOString();
      const next = new Map<string, LiveCell>();
      let newest = 0;
      for (const r of data as Row[]) {
        next.set(r.cell, toLiveCell(r, now));
        if (r.updated_at) newest = Math.max(newest, Date.parse(r.updated_at));
      }
      setByCell(next);
      setUpdatedAt((prev) => Math.max(prev ?? 0, newest) || Date.now());
    };

    load();

    const channels = regions.map((region) =>
      client
        .channel(`region:${region}`, { config: { private: false } })
        .on('broadcast', { event: 'cells' }, ({ payload }) => {
          const {
            upserts = [],
            removed = [],
            at,
          } = payload as {
            upserts?: Row[];
            removed?: string[];
            at?: string;
          };
          setByCell((prev) => {
            const next = new Map(prev);
            for (const cell of removed) next.delete(cell);
            for (const r of upserts)
              next.set(r.cell, toLiveCell(r, at ?? new Date().toISOString()));
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

  const cells = useMemo(() => [...byCell.values()].sort((a, b) => b.devices - a.devices), [byCell]);
  return { cells, updatedAt, source: 'live' };
}
