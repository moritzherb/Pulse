/**
 * Simulated crowd model for Vienna. Development and testing only.
 *
 * Each hotspot has a category, a peak crowd size and a weekly rhythm. The
 * expected number of devices at any moment is peak x rhythm(category, day,
 * hour) x a little noise, spread over the hotspot's cell and its neighbours.
 */

export type Category = 'nightlife' | 'food' | 'sights' | 'outdoors';

export interface Hotspot {
  name: string;
  lat: number;
  lng: number;
  category: Category;
  /** Devices in the centre cell at the busiest hour of the week. */
  peak: number;
}

export const HOTSPOTS: readonly Hotspot[] = [
  { name: 'Stephansplatz', lat: 48.2082, lng: 16.3738, category: 'sights', peak: 35 },
  { name: 'Graben', lat: 48.2087, lng: 16.3696, category: 'food', peak: 20 },
  { name: 'Schwedenplatz', lat: 48.2115, lng: 16.3778, category: 'nightlife', peak: 19 },
  { name: 'Donaukanal', lat: 48.216, lng: 16.383, category: 'nightlife', peak: 28 },
  { name: 'Naschmarkt', lat: 48.1985, lng: 16.3627, category: 'food', peak: 25 },
  { name: 'MuseumsQuartier', lat: 48.2032, lng: 16.356, category: 'sights', peak: 21 },
  { name: 'Spittelberg', lat: 48.2033, lng: 16.3527, category: 'food', peak: 13 },
  { name: 'Mariahilfer Straße', lat: 48.1985, lng: 16.3455, category: 'food', peak: 22 },
  { name: 'Neubau', lat: 48.201, lng: 16.345, category: 'food', peak: 12 },
  { name: 'Gürtel', lat: 48.2135, lng: 16.3395, category: 'nightlife', peak: 18 },
  { name: 'Brunnenmarkt', lat: 48.2125, lng: 16.3335, category: 'food', peak: 14 },
  { name: 'Rathausplatz', lat: 48.2108, lng: 16.3573, category: 'sights', peak: 17 },
  { name: 'Volksgarten', lat: 48.2077, lng: 16.3605, category: 'outdoors', peak: 11 },
  { name: 'Karlsplatz', lat: 48.1998, lng: 16.3712, category: 'sights', peak: 15 },
  { name: 'Belvedere', lat: 48.1915, lng: 16.3809, category: 'sights', peak: 14 },
  { name: 'Stadtpark', lat: 48.204, lng: 16.38, category: 'outdoors', peak: 12 },
  { name: 'Prater', lat: 48.2167, lng: 16.3959, category: 'outdoors', peak: 25 },
  { name: 'Augarten', lat: 48.2245, lng: 16.3755, category: 'outdoors', peak: 10 },
  { name: 'Schönbrunn', lat: 48.1845, lng: 16.3122, category: 'sights', peak: 23 },
  { name: 'Donauinsel', lat: 48.228, lng: 16.412, category: 'outdoors', peak: 15 },
  { name: 'Alte Donau', lat: 48.2355, lng: 16.4205, category: 'outdoors', peak: 11 },
  { name: 'Hauptbahnhof', lat: 48.1852, lng: 16.3765, category: 'food', peak: 17 },
];

/** Share of a hotspot's crowd in ring 0, 1 and 2 of its H3 cell. */
export const FALLOFF = [1, 0.45, 0.15] as const;

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
  const parts = viennaFormat.formatToParts(at);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const isoDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd) + 1;
  return { isoDay, hour };
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
