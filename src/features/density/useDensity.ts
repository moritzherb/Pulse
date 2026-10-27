import { useEffect, useState } from 'react';

import type { LiveCell } from '@shared/types.ts';

import { buildMockVienna } from './mockVienna';

/** How often the client refreshes. Matches the prototype's 30 s poll. */
const REFRESH_MS = 30_000;

export interface DensitySnapshot {
  cells: LiveCell[];
  /** When this snapshot was produced (ms since epoch). */
  updatedAt: number;
  source: 'mock' | 'live';
}

/**
 * Live k-anonymous cells. Phase 1: static mock data for Vienna. Phase 2
 * replaces the body with the Supabase read + Realtime subscription; the
 * shape returned stays the same.
 */
export function useDensity(): DensitySnapshot {
  const [snapshot, setSnapshot] = useState<DensitySnapshot>(() => ({
    cells: buildMockVienna(),
    updatedAt: Date.now(),
    source: 'mock',
  }));

  useEffect(() => {
    const id = setInterval(
      () => setSnapshot({ cells: buildMockVienna(), updatedAt: Date.now(), source: 'mock' }),
      REFRESH_MS,
    );
    return () => clearInterval(id);
  }, []);

  return snapshot;
}
