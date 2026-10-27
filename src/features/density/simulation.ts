/**
 * Simulated crowd model for Vienna. Development and testing only.
 *
 * Each place has a category, a crowd size at its busiest hour of the week
 * and a weekly rhythm. The expected number of devices at a place at any
 * moment is peak x rhythm(category, day, hour) x a little noise.
 *
 * Shared by scripts/seed-vienna.ts (which writes it into the database) and the
 * app's simulated feed (development builds), so both always agree.
 * Dependency-free apart from h3-js, and imported by relative path so it also
 * runs under plain Node (tsx).
 */
import { latLngToCell } from 'h3-js';

import { K_ANONYMITY, levelForPlace } from '../../../supabase/functions/_shared/levels.ts';
import {
  REGION_RESOLUTION,
  type Category,
  type LivePlace,
  type Trend,
} from '../../../supabase/functions/_shared/types.ts';

export type { Category };

export interface SimVenue {
  /** Stable id for the simulated feed (the seed script gets real ids from the database). */
  id: number;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  kind: string;
  /** Devices at the busiest hour of the week. */
  peak: number;
  /** Size of the place as a circle, for matching on the phone. */
  radiusM: number;
}

type Row = [string, number, number, Category, string, number, number];

// name, lat, lng, category, kind, peak devices, radius in metres
const ROWS: Row[] = [
  ['Naschmarkt', 48.1985, 16.3627, 'food', 'market', 40, 150],
  ['Figlmüller', 48.2088, 16.3752, 'food', 'restaurant', 14, 15],
  ['Café Central', 48.2104, 16.3655, 'food', 'café', 18, 15],
  ['Café Sacher', 48.2039, 16.3696, 'food', 'café', 15, 15],
  ['Café Landtmann', 48.2114, 16.3613, 'food', 'café', 16, 18],
  ['Plachutta Wollzeile', 48.2081, 16.379, 'food', 'restaurant', 14, 15],
  ['Zum Schwarzen Kameel', 48.2096, 16.3698, 'food', 'restaurant', 12, 12],
  ['Brunnenmarkt', 48.2125, 16.3335, 'food', 'market', 30, 120],
  ['Karmelitermarkt', 48.2167, 16.3797, 'food', 'market', 20, 50],
  ['Motto am Fluss', 48.2122, 16.3787, 'food', 'restaurant', 16, 20],
  ['Café Sperl', 48.199, 16.36, 'food', 'café', 12, 12],
  ['Vollpension', 48.1958, 16.361, 'food', 'café', 12, 12],
  ['Schwedenplatz', 48.2115, 16.3772, 'sights', 'square', 30, 50],
  ['Hauptbahnhof', 48.1852, 16.3765, 'sights', 'station', 45, 120],
  ['Mariahilfer Straße', 48.1985, 16.3455, 'sights', 'shopping street', 60, 200],
  ['Flex', 48.2168, 16.3685, 'nightlife', 'club', 40, 25],
  ['Loos Bar', 48.2083, 16.3707, 'nightlife', 'bar', 12, 10],
  ['Strandbar Herrmann', 48.2097, 16.3878, 'nightlife', 'bar', 30, 45],
  ['Badeschiff', 48.2112, 16.3812, 'nightlife', 'bar', 22, 30],
  ['Grelle Forelle', 48.2276, 16.364, 'nightlife', 'club', 35, 25],
  ['Volksgarten Club', 48.2072, 16.36, 'nightlife', 'club', 35, 25],
  ['Chelsea', 48.2108, 16.3385, 'nightlife', 'club', 20, 18],
  ['B72', 48.2148, 16.3407, 'nightlife', 'club', 18, 18],
  ['Bermudadreieck', 48.2117, 16.3745, 'nightlife', 'bar', 35, 70],
  ['Donaukanal', 48.214, 16.38, 'nightlife', 'promenade', 45, 120],
  ['Stephansdom', 48.2085, 16.3731, 'sights', 'church', 60, 45],
  ['Hofburg', 48.2066, 16.3655, 'sights', 'palace', 45, 90],
  ['Albertina', 48.2047, 16.3681, 'sights', 'museum', 35, 40],
  ['Kunsthistorisches Museum', 48.2038, 16.3617, 'sights', 'museum', 40, 50],
  ['Naturhistorisches Museum', 48.2052, 16.3598, 'sights', 'museum', 40, 50],
  ['MuseumsQuartier', 48.2032, 16.3584, 'sights', 'arts centre', 55, 90],
  ['Belvedere', 48.1915, 16.3809, 'sights', 'palace', 35, 90],
  ['Schloss Schönbrunn', 48.1849, 16.3122, 'sights', 'palace', 70, 120],
  ['Tiergarten Schönbrunn', 48.1823, 16.3028, 'outdoors', 'zoo', 60, 150],
  ['Karlskirche', 48.1982, 16.3718, 'sights', 'church', 25, 35],
  ['Riesenrad', 48.2166, 16.3958, 'sights', 'attraction', 30, 30],
  ['Rathausplatz', 48.2108, 16.3573, 'sights', 'square', 50, 90],
  ['Hundertwasserhaus', 48.2073, 16.3943, 'sights', 'attraction', 18, 25],
  ['Staatsoper', 48.2031, 16.3692, 'sights', 'theatre', 40, 35],
  ['Haus des Meeres', 48.1977, 16.353, 'sights', 'aquarium', 30, 25],
  ['Votivkirche', 48.2155, 16.3588, 'sights', 'church', 12, 30],
  ['Stadtpark', 48.204, 16.38, 'outdoors', 'park', 40, 120],
  ['Volksgarten', 48.208, 16.3622, 'outdoors', 'park', 30, 75],
  ['Burggarten', 48.2045, 16.3662, 'outdoors', 'park', 22, 55],
  ['Augarten', 48.2245, 16.3755, 'outdoors', 'park', 35, 180],
  ['Prater Hauptallee', 48.2075, 16.412, 'outdoors', 'park', 45, 250],
  ['Donauinsel', 48.228, 16.412, 'outdoors', 'park', 70, 300],
  ['Alte Donau', 48.237, 16.423, 'outdoors', 'bathing area', 40, 200],
  ['Türkenschanzpark', 48.2345, 16.333, 'outdoors', 'park', 25, 150],
];

export const SIM_VENUES: readonly SimVenue[] = ROWS.map(
  ([name, lat, lng, category, kind, peak, radiusM], i) => ({
    id: i + 1,
    name,
    lat,
    lng,
    category,
    kind,
    peak,
    radiusM,
  }),
);

/** Region (H3 resolution 5) of a simulated place. */
export const simRegion = (v: SimVenue) => latLngToCell(v.lat, v.lng, REGION_RESOLUTION);

/**
 * Hour-of-day curves, 0..1, for an ordinary weekday. Index = local hour.
 * Shaped after typical city footfall: lunch and after-work for food,
 * daytime plateau for sights, afternoons for parks, late nights for bars.
 */
const CURVES: Record<Category, number[]> = {
  //          0     1     2     3     4     5     6     7     8     9    10    11    12    13    14    15    16    17    18    19    20    21    22    23
  nightlife: [
    0.55, 0.4, 0.22, 0.1, 0.04, 0.02, 0.02, 0.03, 0.05, 0.06, 0.08, 0.1, 0.14, 0.15, 0.15, 0.17,
    0.22, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 0.75,
  ],
  food: [
    0.08, 0.04, 0.02, 0.01, 0.01, 0.02, 0.06, 0.18, 0.3, 0.32, 0.38, 0.62, 0.95, 0.9, 0.55, 0.45,
    0.5, 0.62, 0.82, 0.92, 0.78, 0.52, 0.3, 0.16,
  ],
  sights: [
    0.03, 0.02, 0.01, 0.01, 0.01, 0.02, 0.04, 0.1, 0.22, 0.45, 0.7, 0.85, 0.92, 0.95, 1.0, 0.98,
    0.9, 0.78, 0.6, 0.45, 0.35, 0.25, 0.14, 0.06,
  ],
  outdoors: [
    0.02, 0.01, 0.01, 0.01, 0.01, 0.03, 0.08, 0.14, 0.2, 0.28, 0.38, 0.5, 0.6, 0.68, 0.8, 0.9, 0.95,
    0.88, 0.7, 0.5, 0.32, 0.18, 0.08, 0.04,
  ],
};

/** Day-of-week multipliers, Monday = 1 ... Sunday = 7 (ISO). */
const WEEKDAY: Record<Category, Record<number, number>> = {
  nightlife: { 1: 0.45, 2: 0.5, 3: 0.6, 4: 0.75, 5: 1.0, 6: 1.0, 7: 0.5 },
  food: { 1: 0.85, 2: 0.85, 3: 0.88, 4: 0.92, 5: 1.0, 6: 1.0, 7: 0.7 },
  sights: { 1: 0.75, 2: 0.7, 3: 0.75, 4: 0.8, 5: 0.9, 6: 1.0, 7: 0.95 },
  outdoors: { 1: 0.6, 2: 0.6, 3: 0.65, 4: 0.7, 5: 0.8, 6: 1.0, 7: 1.0 },
};

/** Friday and Saturday nights spill past midnight into the next calendar day. */
function nightSpill(category: Category, isoDay: number, hour: number): number {
  if (category !== 'nightlife' || hour > 4) return 1;
  // Early hours of Saturday and Sunday belong to Friday / Saturday night.
  return isoDay === 6 || isoDay === 7 ? 1.7 : 1;
}

const viennaFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Local Vienna day-of-week (ISO) and hour for a UTC instant. */
export function viennaClock(at: Date): { isoDay: number; hour: number } {
  try {
    const parts = viennaFormat.formatToParts(at);
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const isoDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd) + 1;
    if (isoDay > 0) return { isoDay, hour };
  } catch {
    // Engines without time-zone data: fall back to the device's own clock.
  }
  return { isoDay: at.getDay() === 0 ? 7 : at.getDay(), hour: at.getHours() };
}

/** 0..1 rhythm for a category at a moment, with smooth interpolation within the hour. */
export function rhythm(category: Category, at: Date): number {
  const { isoDay, hour } = viennaClock(at);
  const minute = at.getUTCMinutes();
  const curve = CURVES[category];
  const a = curve[hour] ?? 0;
  const b = curve[(hour + 1) % 24] ?? 0;
  const withinHour = a + (b - a) * (minute / 60);
  return withinHour * (WEEKDAY[category][isoDay] ?? 1) * nightSpill(category, isoDay, hour);
}

/** Deterministic pseudo-random 0..1 from a string, for stable per-cell noise. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

// ----------------------------------------------------------- place model ---

/** Expected distinct devices at a place at a moment (noise changes every 5 minutes). */
export function expectedDevices(
  v: { name: string; category: Category; peak: number },
  at: Date,
): number {
  const slot = Math.floor(at.getTime() / 300_000);
  const noise = 0.88 + 0.24 * hash01(`${v.name}:${slot}`);
  return Math.max(0, Math.round(v.peak * rhythm(v.category, at) * noise));
}

/** A snapshot as the server would publish it: under k is 0, otherwise rounded to 5. */
export function publishedDevices(devices: number): number {
  return devices < K_ANONYMITY ? 0 : Math.max(K_ANONYMITY, Math.round(devices / 5) * 5);
}

const MONDAY = Date.UTC(2026, 0, 4, 23); // 00:00 Monday in Vienna (CET)

/**
 * Typical devices per local weekday and hour, built like get_venue_detail():
 * four k-anonymous 15-minute snapshots per hour, averaged. One reference
 * week is enough for the simulation, which repeats weekly.
 */
export function simulatedUsual(v: SimVenue): { d: number; h: number; v: number }[] {
  const out: { d: number; h: number; v: number }[] = [];
  for (let d = 1; d <= 7; d++) {
    for (let h = 0; h < 24; h++) {
      const start = MONDAY + ((d - 1) * 24 + h) * 3_600_000;
      let sum = 0;
      for (let q = 0; q < 4; q++)
        sum += publishedDevices(expectedDevices(v, new Date(start + q * 900_000)));
      out.push({ d, h, v: Math.round((sum / 4) * 10) / 10 });
    }
  }
  return out;
}

const peakCache = new Map<number, number>();

/** The place's usual peak, as refresh_usual_peaks() would compute it. */
export function simulatedUsualPeak(v: SimVenue): number {
  let peak = peakCache.get(v.id);
  if (peak === undefined) {
    peak = Math.max(...simulatedUsual(v).map((p) => p.v));
    peakCache.set(v.id, peak);
  }
  return peak;
}

/** The live place as the server would publish it, or null under k. */
export function simulatedLivePlace(v: SimVenue, now: Date): LivePlace | null {
  const current = expectedDevices(v, now);
  const devices = publishedDevices(current);
  if (devices === 0) return null;
  const before = expectedDevices(v, new Date(now.getTime() - 7.5 * 60_000));
  const trend: Trend = current > before * 1.2 + 1 ? 1 : current < before * 0.8 - 1 ? -1 : 0;
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    kind: v.kind,
    lng: v.lng,
    lat: v.lat,
    devices,
    level: levelForPlace(devices, simulatedUsualPeak(v)),
    trend,
    updatedAt: now.toISOString(),
  };
}
