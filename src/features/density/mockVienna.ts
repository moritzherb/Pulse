import { levelForDevices } from '@shared/levels.ts';
import type { LiveCell, Trend } from '@shared/types.ts';

import type { CellDetail } from '@/features/detail/types';

import {
  expectedDevices,
  HOTSPOTS,
  publishedDevices,
  simulatedCells,
  simulatedUsual,
} from './simulation';

/**
 * The simulated feed for development builds: the same Vienna crowd model the
 * seed script writes into the database, evaluated on the phone. The server's
 * rules are applied (k >= 5, rounded to 5), so it looks exactly like live data.
 */

const HALF_WINDOW_MS = 7.5 * 60_000;

export function buildMockVienna(now = new Date()): LiveCell[] {
  const cells: LiveCell[] = [];
  for (const c of simulatedCells()) {
    const devices = publishedDevices(expectedDevices(c, now));
    if (devices === 0) continue;
    const before = expectedDevices(c, new Date(now.getTime() - HALF_WINDOW_MS));
    const current = expectedDevices(c, now);
    const trend: Trend = current > before * 1.2 + 1 ? 1 : current < before * 0.8 - 1 ? -1 : 0;
    cells.push({
      cell: c.cell,
      devices,
      level: levelForDevices(devices),
      trend,
      category: c.main.category,
      label: c.main.name,
      updatedAt: now.toISOString(),
    });
  }
  return cells.sort((a, b) => b.devices - a.devices);
}

/** Detail sheet payload for a simulated cell (see get_cell_detail()). */
export function mockCellDetail(cell: string, now = new Date()): CellDetail {
  const sim = simulatedCells().find((c) => c.cell === cell);
  const live = buildMockVienna(now).find((c) => c.cell === cell) ?? null;
  return {
    cell,
    label: sim?.main.name ?? null,
    live,
    usual: sim ? { weeks: 4, hours: simulatedUsual(sim) } : { weeks: 0, hours: [] },
    venues: [],
  };
}

/** Hotspots as pins, so venue pins can be tried out without a backend. */
export function mockVenues() {
  return HOTSPOTS.map((h, i) => ({
    id: -1 - i,
    name: h.name,
    category: h.category,
    kind: 'simulated area',
    lng: h.lng,
    lat: h.lat,
    cell: null as string | null,
  }));
}
