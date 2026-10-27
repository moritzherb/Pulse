/**
 * Cities offered by the search field, from the design prototype. Bundled so
 * a search never leaves the phone (no geocoding service).
 */

export interface City {
  name: string;
  country: string;
  lng: number;
  lat: number;
}

const RAW: readonly [name: string, country: string, lng: number, lat: number][] = [
  ['Vienna', 'Austria', 16.3738, 48.2082],
  ['Berlin', 'Germany', 13.405, 52.52],
  ['Paris', 'France', 2.3522, 48.8566],
  ['Barcelona', 'Spain', 2.1734, 41.3851],
  ['Tokyo', 'Japan', 139.6917, 35.6895],
  ['New York', 'United States', -73.9857, 40.7484],
  ['London', 'United Kingdom', -0.1276, 51.5072],
  ['Amsterdam', 'Netherlands', 4.9041, 52.3676],
  ['Prague', 'Czechia', 14.4378, 50.0755],
  ['Budapest', 'Hungary', 19.0402, 47.4979],
  ['Munich', 'Germany', 11.582, 48.1351],
  ['Zurich', 'Switzerland', 8.5417, 47.3769],
  ['Milan', 'Italy', 9.19, 45.4642],
  ['Rome', 'Italy', 12.4964, 41.9028],
  ['Lisbon', 'Portugal', -9.1393, 38.7223],
  ['Madrid', 'Spain', -3.7038, 40.4168],
  ['Copenhagen', 'Denmark', 12.5683, 55.6761],
  ['Stockholm', 'Sweden', 18.0686, 59.3293],
  ['Warsaw', 'Poland', 21.0122, 52.2297],
  ['Istanbul', 'Türkiye', 28.9784, 41.0082],
  ['Athens', 'Greece', 23.7275, 37.9838],
  ['Dublin', 'Ireland', -6.2603, 53.3498],
  ['Oslo', 'Norway', 10.7522, 59.9139],
  ['Helsinki', 'Finland', 24.9384, 60.1699],
  ['Brussels', 'Belgium', 4.3517, 50.8503],
  ['Hamburg', 'Germany', 9.9937, 53.5511],
  ['Graz', 'Austria', 15.4395, 47.0707],
  ['Salzburg', 'Austria', 13.055, 47.8095],
  ['San Francisco', 'United States', -122.4194, 37.7749],
  ['Los Angeles', 'United States', -118.2437, 34.0522],
  ['Chicago', 'United States', -87.6298, 41.8781],
  ['Toronto', 'Canada', -79.3832, 43.6532],
  ['Mexico City', 'Mexico', -99.1332, 19.4326],
  ['São Paulo', 'Brazil', -46.6333, -23.5505],
  ['Buenos Aires', 'Argentina', -58.3816, -34.6037],
  ['Cape Town', 'South Africa', 18.4241, -33.9249],
  ['Dubai', 'United Arab Emirates', 55.2708, 25.2048],
  ['Mumbai', 'India', 72.8777, 19.076],
  ['Bangkok', 'Thailand', 100.5018, 13.7563],
  ['Singapore', 'Singapore', 103.8198, 1.3521],
  ['Hong Kong', 'Hong Kong SAR', 114.1694, 22.3193],
  ['Seoul', 'South Korea', 126.978, 37.5665],
  ['Sydney', 'Australia', 151.2093, -33.8688],
  ['Melbourne', 'Australia', 144.9631, -37.8136],
  ['Auckland', 'New Zealand', 174.7633, -36.8485],
];

export const CITIES: readonly City[] = RAW.map(([name, country, lng, lat]) => ({
  name,
  country,
  lng,
  lat,
}));

export const DEFAULT_CITY: City = CITIES[0]!;

/** Prefix matches first, then substring or country matches. Mirrors the prototype. */
export function searchCities(query: string, limit = 6): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: City[] = [];
  const contains: City[] = [];
  for (const c of CITIES) {
    const n = c.name.toLowerCase();
    if (n.startsWith(q)) starts.push(c);
    else if (n.includes(q) || c.country.toLowerCase().startsWith(q)) contains.push(c);
  }
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
