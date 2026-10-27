/**
 * Turn OpenStreetMap elements into Pulse venues and places. Pure functions,
 * no I/O, so they can be unit-tested with fixtures.
 *
 * Venues give a cell its category and the map its pins. Places name areas
 * ("Spittelberg", "Stephansplatz") for the "Busiest now" list and sheet titles.
 */

export type Category = 'nightlife' | 'food' | 'sights' | 'outdoors';

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  /** Present for ways / relations with `out center`. */
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface VenueRow {
  sourceId: string;
  name: string;
  category: Category;
  kind: string;
  rank: 1 | 2 | 3;
  lat: number;
  lng: number;
}

export interface PlaceRow {
  sourceId: string;
  name: string;
  kind: 'area' | 'landmark';
  lat: number;
  lng: number;
}

/** Bounding box (south, west, north, east) of the City of Vienna. */
export const VIENNA_BBOX = [48.118, 16.182, 48.323, 16.578] as const;

const VENUE_RULES: { key: string; values: Record<string, [Category, string]> }[] = [
  {
    key: 'amenity',
    values: {
      bar: ['nightlife', 'bar'],
      pub: ['nightlife', 'pub'],
      nightclub: ['nightlife', 'club'],
      biergarten: ['nightlife', 'beer garden'],
      restaurant: ['food', 'restaurant'],
      cafe: ['food', 'café'],
      fast_food: ['food', 'fast food'],
      food_court: ['food', 'food court'],
      ice_cream: ['food', 'ice cream'],
      marketplace: ['food', 'market'],
      theatre: ['sights', 'theatre'],
      arts_centre: ['sights', 'arts centre'],
    },
  },
  {
    key: 'tourism',
    values: {
      attraction: ['sights', 'attraction'],
      museum: ['sights', 'museum'],
      gallery: ['sights', 'gallery'],
      viewpoint: ['sights', 'viewpoint'],
      zoo: ['outdoors', 'zoo'],
      theme_park: ['outdoors', 'theme park'],
    },
  },
  {
    key: 'historic',
    values: {
      castle: ['sights', 'castle'],
      palace: ['sights', 'palace'],
      monument: ['sights', 'monument'],
    },
  },
  {
    key: 'leisure',
    values: {
      park: ['outdoors', 'park'],
      garden: ['outdoors', 'garden'],
      beach_resort: ['outdoors', 'bathing area'],
    },
  },
];

const PLACE_KINDS: Record<string, PlaceRow['kind']> = {
  suburb: 'area',
  quarter: 'area',
  neighbourhood: 'area',
  square: 'landmark',
};

/** The Overpass QL query for one bounding box. */
export function overpassQuery([south, west, north, east]: readonly number[]): string {
  const bbox = `${south},${west},${north},${east}`;
  return `[out:json][timeout:300];
(
  nwr["amenity"~"^(${Object.keys(VENUE_RULES[0]!.values).join('|')})$"]["name"](${bbox});
  nwr["tourism"~"^(${Object.keys(VENUE_RULES[1]!.values).join('|')})$"]["name"](${bbox});
  nwr["historic"~"^(${Object.keys(VENUE_RULES[2]!.values).join('|')})$"]["name"](${bbox});
  nwr["leisure"~"^(${Object.keys(VENUE_RULES[3]!.values).join('|')})$"]["name"](${bbox});
  nwr["place"~"^(${Object.keys(PLACE_KINDS).join('|')})$"]["name"](${bbox});
);
out center tags;`;
}

function position(el: OsmElement): { lat: number; lng: number } | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  return lat === undefined || lng === undefined ? null : { lat, lng };
}

/**
 * How prominent a venue is. 3: landmark with a Wikidata entry (sights and
 * parks). 2: has Wikidata, or is a sight. 1: everything else.
 */
function rankOf(tags: Record<string, string>, category: Category): 1 | 2 | 3 {
  const wiki = Boolean(tags.wikidata || tags.wikipedia);
  if (wiki && (category === 'sights' || category === 'outdoors')) return 3;
  if (wiki || category === 'sights') return 2;
  return 1;
}

export function classify(el: OsmElement): { venue?: VenueRow; place?: PlaceRow } {
  const tags = el.tags ?? {};
  const name = tags['name:de'] ?? tags.name;
  const pos = position(el);
  if (!name || !pos) return {};
  const sourceId = `${el.type}/${el.id}`;

  const placeKind = tags.place ? PLACE_KINDS[tags.place] : undefined;
  if (placeKind) {
    return { place: { sourceId, name, kind: placeKind, ...pos } };
  }

  for (const rule of VENUE_RULES) {
    const value = tags[rule.key];
    const hit = value ? rule.values[value] : undefined;
    if (hit) {
      const [category, kind] = hit;
      return { venue: { sourceId, name, category, kind, rank: rankOf(tags, category), ...pos } };
    }
  }
  return {};
}

/** Classify a whole Overpass response, dropping duplicates and unusable elements. */
export function parseOverpass(json: { elements?: OsmElement[] }): {
  venues: VenueRow[];
  places: PlaceRow[];
} {
  const venues = new Map<string, VenueRow>();
  const places = new Map<string, PlaceRow>();
  for (const el of json.elements ?? []) {
    const { venue, place } = classify(el);
    if (venue) venues.set(venue.sourceId, venue);
    if (place) places.set(place.sourceId, place);
  }
  return { venues: [...venues.values()], places: [...places.values()] };
}
