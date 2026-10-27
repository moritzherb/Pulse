import { useEffect, useState } from 'react';

import { mockCellDetail } from '@/features/density/mockVienna';
import { useSimulatedFeed } from '@/features/density/useDensity';
import { supabase } from '@/lib/supabase';
import { levelFromRank } from '@shared/levels.ts';
import type { Category, Trend } from '@shared/types.ts';

import type { CellDetail } from './types';

/** The phone's IANA time zone, so "usually busy at" uses local hours. */
function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

type Remote = {
  cell: string;
  label: string | null;
  live: {
    devices: number;
    level: number;
    trend: number;
    label: string | null;
    category: string | null;
    updatedAt: string;
  } | null;
  usual: CellDetail['usual'];
  venues: CellDetail['venues'];
} | null;

export type DetailState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; detail: CellDetail };

/**
 * History and venues for one cell. The live numbers in the sheet come from
 * the map's live data instead, so they keep updating while the sheet is open.
 */
export function useCellDetail(cell: string | null): DetailState {
  const simulated = useSimulatedFeed() || !supabase;
  const [state, setState] = useState<{ cell: string | null; value: DetailState }>({
    cell: null,
    value: { status: 'loading' },
  });

  useEffect(() => {
    if (!cell) return;
    let cancelled = false;
    const done = (value: DetailState) => {
      if (!cancelled) setState({ cell, value });
    };

    if (simulated) {
      // Defer like a network call, so both paths render the same way.
      const t = setTimeout(() => done({ status: 'ready', detail: mockCellDetail(cell) }), 0);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    supabase?.rpc('get_cell_detail', { p_cell: cell, p_tz: timeZone() }).then(({ data, error }) => {
      const r = data as Remote;
      if (error || !r) return done({ status: 'error' });
      done({
        status: 'ready',
        detail: {
          cell: r.cell,
          label: r.label,
          live: r.live
            ? {
                cell: r.cell,
                devices: r.live.devices,
                level: levelFromRank(r.live.level),
                trend: Math.sign(r.live.trend) as Trend,
                label: r.live.label,
                category: r.live.category as Category | null,
                updatedAt: r.live.updatedAt,
              }
            : null,
          usual: r.usual,
          venues: r.venues,
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [cell, simulated]);

  // A different cell than the one we hold data for: still loading.
  return state.cell === cell ? state.value : { status: 'loading' };
}
