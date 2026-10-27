// Stand-in for the Supabase side, with the same rules as the SQL:
// 20-minute retention, COUNT(DISTINCT anon_id), cells under k=5 never leave,
// counts rounded to the nearest 5, no raw ping query exposed to the view layer.

const TTL_MS = 20 * 60 * 1000;
const K = 5;
const CATEGORIES = ['nightlife', 'food', 'sights', 'outdoors'];

let pings = []; // { h3_index, category, anon_id, created_at }
let previous = new Map(); // h3 -> last approx count, for trend

function prune() {
  const cutoff = Date.now() - TTL_MS;
  pings = pings.filter((p) => p.created_at > cutoff);
}

export function insertPing(ping) {
  prune();
  pings.push({ ...ping, created_at: Date.now() });
}

export function deleteByAnonId(anon_id) {
  const before = pings.length;
  pings = pings.filter((p) => p.anon_id !== anon_id);
  return before - pings.length;
}

export function outstandingFor(anon_id) {
  prune();
  return pings.filter((p) => p.anon_id === anon_id).length;
}

export function totalRows() {
  prune();
  return pings.length;
}

// The only read the client gets. Mirrors public.aggregate_density().
export function aggregateDensity(categories) {
  prune();
  const wanted = categories && categories.length ? categories : CATEGORIES;
  const byCell = new Map();
  for (const p of pings) {
    if (!wanted.includes(p.category)) continue;
    if (!byCell.has(p.h3_index)) byCell.set(p.h3_index, { ids: new Set(), cats: new Map() });
    const e = byCell.get(p.h3_index);
    e.ids.add(p.anon_id);
    e.cats.set(p.category, (e.cats.get(p.category) || 0) + 1);
  }
  const out = [];
  for (const [h3_index, e] of byCell) {
    const distinct = e.ids.size;
    if (distinct < K) continue; // filtered server-side
    const approx = Math.round(distinct / 5) * 5;
    let top = null;
    let best = -1;
    for (const [c, n] of e.cats) if (n > best) { best = n; top = c; }
    const prev = previous.get(h3_index);
    out.push({
      h3_index,
      approx_count: approx,
      top_category: top,
      trend: prev == null ? 0 : Math.sign(approx - prev),
    });
  }
  for (const r of out) previous.set(r.h3_index, r.approx_count);
  out.sort((a, b) => b.approx_count - a.approx_count);
  return out;
}

// ---- simulation only -------------------------------------------------------
// Labelled as simulated everywhere it surfaces. Never presented as real.

export const HOTSPOTS = {
  Vienna: [
    ['Stephansplatz', 48.2082, 16.3738, 'sights', 34],
    ['Donaukanal', 48.216, 16.383, 'nightlife', 26],
    ['Naschmarkt', 48.1985, 16.3627, 'food', 22],
    ['MuseumsQuartier', 48.2032, 16.356, 'sights', 19],
    ['Neubau', 48.201, 16.345, 'food', 16],
    ['Prater', 48.2167, 16.3959, 'outdoors', 14],
    ['Stadtpark', 48.204, 16.38, 'outdoors', 9],
    ['Schönbrunn', 48.1845, 16.3122, 'sights', 12],
    ['Karlsplatz', 48.1978, 16.3712, 'food', 7],
    ['Donauinsel', 48.228, 16.412, 'outdoors', 4],
  ],
  Berlin: [
    ['Kreuzberg', 52.4996, 13.4183, 'nightlife', 30],
    ['Mitte', 52.5219, 13.4132, 'sights', 24],
    ['Neukölln', 52.4795, 13.4353, 'food', 18],
    ['Tempelhofer Feld', 52.4735, 13.4035, 'outdoors', 12],
  ],
  Paris: [
    ['Le Marais', 48.8595, 2.3616, 'food', 26],
    ['Louvre', 48.8606, 2.3376, 'sights', 30],
    ['Oberkampf', 48.865, 2.3792, 'nightlife', 20],
    ['Buttes-Chaumont', 48.8768, 2.3822, 'outdoors', 10],
  ],
  Barcelona: [
    ['El Born', 41.3851, 2.1829, 'nightlife', 28],
    ['Sagrada Família', 41.4036, 2.1744, 'sights', 32],
    ['Gràcia', 41.4045, 2.1557, 'food', 18],
    ['Parc de la Ciutadella', 41.3882, 2.1879, 'outdoors', 11],
  ],
  Tokyo: [
    ['Shibuya', 35.6595, 139.7005, 'nightlife', 36],
    ['Shinjuku', 35.6938, 139.7034, 'food', 30],
    ['Asakusa', 35.7148, 139.7967, 'sights', 22],
    ['Yoyogi Park', 35.6717, 139.6949, 'outdoors', 12],
  ],
  'New York': [
    ['Lower East Side', 40.7185, -73.9875, 'nightlife', 30],
    ['Times Square', 40.758, -73.9855, 'sights', 34],
    ['West Village', 40.7336, -74.0027, 'food', 20],
    ['Prospect Park', 40.6602, -73.969, 'outdoors', 12],
  ],
  London: [
    ['Soho', 51.5137, -0.1341, 'nightlife', 32],
    ['Borough Market', 51.5055, -0.0909, 'food', 26],
    ['South Bank', 51.5052, -0.1165, 'sights', 30],
    ['Hampstead Heath', 51.5608, -0.1633, 'outdoors', 13],
  ],
  Amsterdam: [
    ['De Pijp', 52.3545, 4.8925, 'food', 22],
    ['Rembrandtplein', 52.3663, 4.8955, 'nightlife', 26],
    ['Museumplein', 52.3579, 4.8811, 'sights', 24],
    ['Vondelpark', 52.3579, 4.8686, 'outdoors', 14],
  ],
  Prague: [
    ['Old Town Square', 50.087, 14.4208, 'sights', 30],
    ['Žižkov', 50.0874, 14.4506, 'nightlife', 22],
    ['Vinářské Karlín', 50.0902, 14.4519, 'food', 15],
    ['Letná', 50.0966, 14.4165, 'outdoors', 12],
  ],
  Budapest: [
    ['Ruin bars', 47.4972, 19.0616, 'nightlife', 28],
    ['Great Market Hall', 47.4874, 19.0587, 'food', 20],
    ['Castle Hill', 47.4967, 19.0396, 'sights', 26],
    ['Margaret Island', 47.5273, 19.0501, 'outdoors', 12],
  ],
  Munich: [
    ['Marienplatz', 48.1374, 11.5755, 'sights', 28],
    ['Viktualienmarkt', 48.1352, 11.5762, 'food', 22],
    ['Glockenbach', 48.1289, 11.5701, 'nightlife', 20],
    ['Englischer Garten', 48.1642, 11.6055, 'outdoors', 16],
  ],
  Barcelona: [
    ['El Born', 41.3851, 2.1829, 'nightlife', 28],
    ['Sagrada Família', 41.4036, 2.1744, 'sights', 32],
    ['Gràcia', 41.4045, 2.1557, 'food', 18],
    ['Ciutadella', 41.3882, 2.1879, 'outdoors', 11],
  ],
  Rome: [
    ['Trastevere', 41.889, 12.4696, 'food', 26],
    ['Colosseum', 41.8902, 12.4922, 'sights', 34],
    ['Monti', 41.8955, 12.4924, 'nightlife', 18],
    ['Villa Borghese', 41.9142, 12.4923, 'outdoors', 13],
  ],
  Lisbon: [
    ['Bairro Alto', 38.7118, -9.1449, 'nightlife', 27],
    ['Time Out Market', 38.707, -9.1459, 'food', 22],
    ['Alfama', 38.7118, -9.1284, 'sights', 25],
    ['Parque Eduardo VII', 38.7275, -9.1519, 'outdoors', 11],
  ],
  Madrid: [
    ['Malasaña', 40.4262, -3.7038, 'nightlife', 28],
    ['La Latina', 40.4109, -3.7098, 'food', 22],
    ['Prado', 40.4138, -3.6921, 'sights', 26],
    ['Retiro', 40.4153, -3.6844, 'outdoors', 15],
  ],
  Copenhagen: [
    ['Vesterbro', 55.6698, 12.5468, 'nightlife', 22],
    ['Torvehallerne', 55.6836, 12.5693, 'food', 20],
    ['Nyhavn', 55.6796, 12.5912, 'sights', 26],
    ['Islands Brygge', 55.6634, 12.5787, 'outdoors', 12],
  ],
  Istanbul: [
    ['Karaköy', 41.0226, 28.9743, 'food', 28],
    ['Sultanahmet', 41.0055, 28.9769, 'sights', 34],
    ['Beyoğlu', 41.0339, 28.9776, 'nightlife', 26],
    ['Yeşil Ada', 41.0451, 29.0243, 'outdoors', 12],
  ],
  'San Francisco': [
    ['Mission', 37.7599, -122.4148, 'food', 26],
    ['North Beach', 37.8004, -122.4102, 'nightlife', 22],
    ['Ferry Building', 37.7955, -122.3937, 'sights', 24],
    ['Golden Gate Park', 37.7694, -122.4862, 'outdoors', 16],
  ],
  'Mexico City': [
    ['Roma Norte', 19.4155, -99.1652, 'food', 30],
    ['Centro Histórico', 19.4326, -99.1332, 'sights', 32],
    ['Condesa', 19.4116, -99.1749, 'nightlife', 24],
    ['Chapultepec', 19.4204, -99.1817, 'outdoors', 16],
  ],
  Bangkok: [
    ['Yaowarat', 13.7404, 100.5093, 'food', 32],
    ['Grand Palace', 13.75, 100.4913, 'sights', 30],
    ['Thonglor', 13.7318, 100.5825, 'nightlife', 24],
    ['Lumphini Park', 13.7317, 100.5417, 'outdoors', 14],
  ],
  Singapore: [
    ['Chinatown', 1.2836, 103.8436, 'food', 28],
    ['Marina Bay', 1.2834, 103.8607, 'sights', 32],
    ['Clarke Quay', 1.2906, 103.8465, 'nightlife', 22],
    ['Botanic Gardens', 1.3138, 103.8159, 'outdoors', 15],
  ],
  'Hong Kong': [
    ['Central', 22.2819, 114.1585, 'sights', 30],
    ['Sheung Wan', 22.2865, 114.1494, 'food', 24],
    ['Lan Kwai Fong', 22.2807, 114.1554, 'nightlife', 26],
    ['Victoria Peak', 22.2759, 114.1455, 'outdoors', 14],
  ],
  Seoul: [
    ['Hongdae', 37.5563, 126.9236, 'nightlife', 30],
    ['Gwangjang Market', 37.5701, 126.9997, 'food', 26],
    ['Gyeongbokgung', 37.5796, 126.977, 'sights', 28],
    ['Han River Park', 37.5175, 126.9964, 'outdoors', 15],
  ],
  Sydney: [
    ['Surry Hills', -33.8845, 151.2114, 'food', 24],
    ['Opera House', -33.8568, 151.2153, 'sights', 32],
    ['Newtown', -33.8983, 151.1793, 'nightlife', 20],
    ['Bondi', -33.8915, 151.2767, 'outdoors', 18],
  ],
  Toronto: [
    ['Kensington Market', 43.6544, -79.4005, 'food', 22],
    ['Distillery District', 43.6503, -79.3596, 'sights', 24],
    ['Ossington', 43.6519, -79.4198, 'nightlife', 20],
    ['Trinity Bellwoods', 43.6469, -79.4131, 'outdoors', 13],
  ],
  'São Paulo': [
    ['Vila Madalena', -23.5546, -46.6906, 'nightlife', 28],
    ['Mercado Municipal', -23.5419, -46.6294, 'food', 24],
    ['Avenida Paulista', -23.5614, -46.6558, 'sights', 30],
    ['Ibirapuera', -23.5874, -46.6576, 'outdoors', 18],
  ],
  Dubai: [
    ['Downtown', 25.1972, 55.2744, 'sights', 32],
    ['Al Seef', 25.2637, 55.2972, 'food', 22],
    ['Marina', 25.0805, 55.1403, 'nightlife', 24],
    ['Kite Beach', 25.1743, 55.2325, 'outdoors', 16],
  ],
};

// Cities without hand-authored districts still get density, labelled honestly by
// compass sector rather than with an invented neighbourhood name.
const SECTORS = [['Centre', 0, 0], ['North side', 0.012, 0], ['East side', 0, 0.018], ['South side', -0.012, 0], ['West side', 0, -0.018]];
const SECTOR_CATS = ['sights', 'nightlife', 'food', 'outdoors', 'food'];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

function generatedHotspots(city) {
  const c = CITIES.find((x) => x.name === city);
  if (!c) return [];
  const h = hash(city);
  return SECTORS.map(([label, dlat, dlng], i) => [
    label, c.lat + dlat, c.lng + dlng, SECTOR_CATS[i],
    8 + ((h >> (i * 3)) % 22), // 8..29, stable per city
  ]);
}

function spotsFor(city) {
  return HOTSPOTS[city] || generatedHotspots(city);
}

export function seedSimulated(city, cellFromLatLng, intensity = 1) {
  const spots = spotsFor(city);
  const target = spots.reduce((a, s) => a + s[4], 0);
  const existing = pings.filter((p) => String(p.anon_id).startsWith('sim-' + city)).length;
  if (existing >= target) return; // cap so repeated polls don't inflate counts
  for (const [, lat, lng, category, n] of spots) {
    const count = Math.max(0, Math.round(n * intensity));
    for (let i = 0; i < count; i++) {
      const jlat = lat + (Math.random() - 0.5) * 0.004;
      const jlng = lng + (Math.random() - 0.5) * 0.006;
      insertPing({
        h3_index: cellFromLatLng(jlat, jlng),
        category,
        anon_id: 'sim-' + city + '-' + Math.random().toString(36).slice(2, 10),
      });
    }
  }
}

export function clearSimulated() {
  pings = pings.filter((p) => !String(p.anon_id).startsWith('sim-'));
  previous = new Map();
}

export function driftSimulated() {
  // small churn so the 30 s poll shows movement
  pings = pings.filter((p) => !String(p.anon_id).startsWith('sim-') || Math.random() > 0.12);
}

export const CITIES = [
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
].map(([name, country, lng, lat]) => ({ name, country, lng, lat }));

export function searchCities(q, limit = 6) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return [];
  const starts = [];
  const contains = [];
  for (const c of CITIES) {
    const n = c.name.toLowerCase();
    if (n.startsWith(s)) starts.push(c);
    else if (n.includes(s) || c.country.toLowerCase().startsWith(s)) contains.push(c);
  }
  return starts.concat(contains).slice(0, limit);
}

export function nearestCity(lat, lng) {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function nearestLabel(city, lat, lng) {
  const spots = spotsFor(city);
  let best = null;
  let bestD = Infinity;
  for (const [name, slat, slng] of spots) {
    const d = (slat - lat) ** 2 + (slng - lng) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best || city;
}
