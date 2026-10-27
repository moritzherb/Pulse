import { gridDisk, latLngToCell } from 'h3-js';

import { K_ANONYMITY, levelForDevices } from '@shared/levels.ts';
import { H3_RESOLUTION, type Category, type LiveCell, type Trend } from '@shared/types.ts';

/**
 * Static mock crowd data for Vienna, used until the Supabase pipeline lands
 * (Phase 2). Hotspots and peak counts are the design prototype's. Each
 * hotspot spills into its neighbouring cells with falling counts; the same
 * k-anonymity floor and rounding as the server are applied, so the map looks
 * exactly like real data would.
 */

type Hotspot = [name: string, lat: number, lng: number, category: Category, peak: number];

export const VIENNA_HOTSPOTS: readonly Hotspot[] = [
  ['Stephansplatz', 48.2082, 16.3738, 'sights', 38],
  ['Donaukanal', 48.216, 16.383, 'nightlife', 28],
  ['Naschmarkt', 48.1985, 16.3627, 'food', 24],
  ['MuseumsQuartier', 48.2032, 16.356, 'sights', 21],
  ['Neubau', 48.201, 16.345, 'food', 16],
  ['Prater', 48.2167, 16.3959, 'outdoors', 15],
  ['Stadtpark', 48.204, 16.38, 'outdoors', 11],
  ['Schönbrunn', 48.1845, 16.3122, 'sights', 13],
  ['Karlsplatz', 48.1978, 16.3712, 'food', 9],
  ['Donauinsel', 48.228, 16.412, 'outdoors', 7],
];

/** Share of the peak that reaches ring 0, 1 and 2 around a hotspot. */
const FALLOFF = [1, 0.5, 0.22];

function roundToFive(n: number): number {
  return Math.round(n / 5) * 5;
}

/** Small deterministic hash so trends are stable between launches. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function buildMockVienna(now = new Date()): LiveCell[] {
  const best = new Map<string, { raw: number; spot: Hotspot }>();
  for (const spot of VIENNA_HOTSPOTS) {
    const [, lat, lng, , peak] = spot;
    const centre = latLngToCell(lat, lng, H3_RESOLUTION);
    const seen = new Set<string>();
    FALLOFF.forEach((share, ring) => {
      for (const cell of gridDisk(centre, ring)) {
        if (seen.has(cell)) continue;
        seen.add(cell);
        // A little per-cell variation so rings are not perfectly uniform.
        const jitter = 0.85 + (hash(cell) % 30) / 100;
        const raw = peak * share * jitter;
        const prev = best.get(cell);
        if (!prev || raw > prev.raw) best.set(cell, { raw, spot });
      }
    });
  }

  const cells: LiveCell[] = [];
  for (const [cell, { raw, spot }] of best) {
    if (raw < K_ANONYMITY) continue; // never shown below k, same as the server
    const devices = Math.max(K_ANONYMITY, roundToFive(raw));
    cells.push({
      cell,
      devices,
      level: levelForDevices(devices),
      trend: ((hash(cell + 't') % 3) - 1) as Trend,
      category: spot[3],
      label: spot[0],
      updatedAt: now.toISOString(),
    });
  }
  return cells.sort((a, b) => b.devices - a.devices);
}
