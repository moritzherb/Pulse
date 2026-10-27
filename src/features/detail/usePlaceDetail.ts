import { useEffect, useState } from 'react';

import { mockPlaceDetail } from '@/features/density/mockVienna';
import { useSimulatedFeed } from '@/features/density/useDensity';
import { supabase } from '@/lib/supabase';
import { levelFromRank } from '@shared/levels.ts';
import type { Category, Trend } from '@shared/types.ts';

import type { PlaceDetail } from './types';

/** The phone's IANA time zone, so "usually busy at" uses local hours. */
function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

type Remote = {
  place: PlaceDetail['place'];
  live: { devices: number; level: number; trend: number; updatedAt: string } | null;
  usual: PlaceDetail['usual'];
  nearby: { id: number; name: string; category: string; devices: number; level: number }[];
} | null;

export type DetailState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; detail: PlaceDetail };

/**
 * History and nearby places for one place. The live numbers in the sheet
 * come from the map's live data instead, so they keep updating while the
 * sheet is open.
 */
export function usePlaceDetail(id: number | null): DetailState {
  const simulated = useSimulatedFeed();
  const [state, setState] = useState<{ id: number | null; value: DetailState }>({
    id: null,
    value: { status: 'loading' },
  });

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    const done = (value: DetailState) => {
      if (!cancelled) setState({ id, value });
    };

    if (simulated || !supabase) {
      // Defer like a network call, so both paths render the same way. No
      // backend and no simulation (a misconfigured release build) is an error.
      const detail = simulated ? mockPlaceDetail(id) : null;
      const t = setTimeout(
        () => done(detail ? { status: 'ready', detail } : { status: 'error' }),
        0,
      );
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    supabase.rpc('get_venue_detail', { p_venue: id, p_tz: timeZone() }).then(({ data, error }) => {
      const r = data as Remote;
      if (error || !r) return done({ status: 'error' });
      done({
        status: 'ready',
        detail: {
          place: r.place,
          live: r.live
            ? {
                devices: r.live.devices,
                level: levelFromRank(r.live.level),
                trend: Math.sign(r.live.trend) as Trend,
                updatedAt: r.live.updatedAt,
              }
            : null,
          usual: r.usual,
          nearby: r.nearby.map((n) => ({
            id: n.id,
            name: n.name,
            category: n.category as Category,
            devices: n.devices,
            level: levelFromRank(n.level),
          })),
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id, simulated]);

  // A different place than the one we hold data for: still loading.
  return state.id === id ? state.value : { status: 'loading' };
}
