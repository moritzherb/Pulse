import { COUNTRIES, WORLD_CITIES } from './worldCities';

/**
 * Cities offered by the search field: every city in the world with at least
 * 100,000 people, plus every capital (src/data/worldCities.ts, generated from
 * GeoNames). Bundled so a search never leaves the phone (no geocoding
 * service).
 */

export interface City {
  name: string;
  country: string;
  lng: number;
  lat: number;
  population: number;
}

/** Largest first, so the best-known match comes first. */
export const CITIES: readonly City[] = WORLD_CITIES.map(([name, code, lng, lat, population]) => ({
  name,
  country: COUNTRIES[code] ?? code,
  lng,
  lat,
  population,
}));

export const DEFAULT_CITY: City = CITIES.find((c) => c.name === 'Vienna') ?? CITIES[0]!;

/** Lower case without accents, so "zurich" finds Zürich and "sao" São Paulo. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const FOLDED = CITIES.map((c) => ({ name: fold(c.name), country: fold(c.country) }));

/** Prefix matches first, then substring or country matches; largest first within each. */
export function searchCities(query: string, limit = 6): City[] {
  const q = fold(query.trim());
  if (!q) return [];
  const starts: City[] = [];
  const contains: City[] = [];
  CITIES.forEach((c, i) => {
    const f = FOLDED[i]!;
    if (f.name.startsWith(q)) starts.push(c);
    else if (contains.length < limit && (f.name.includes(q) || f.country.startsWith(q)))
      contains.push(c);
  });
  return starts.concat(contains).slice(0, limit);
}

/** Closest city to a point (equirectangular distance is plenty at this scale). */
export function nearestCity(lat: number, lng: number): City {
  let best = DEFAULT_CITY;
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
