/**
 * Turn OpenStreetMap elements into Pulse venues and places. Pure functions,
 * no I/O, so they can be unit-tested with fixtures.
 *
 * Venues are the places people are counted at: every named restaurant, café,
 * bar, museum, sight, square, park and so on. Each gets a shape the phone can
 * test its position against: the mapped outline when OSM has one, otherwise
 * a circle sized for its kind. Places name wider areas ("Spittelberg") for
 * the detail sheet.
 */
import {
  assembleRings,
  distanceM,
  ringAreaM2,
  ringCentroid,
  type Position,
  type Ring,
} from '../geometry.ts';

export type Category = 'nightlife' | 'food' | 'sights' | 'outdoors';

interface LatLon {
  lat: number;
  lon: number;
}

/** One element of an Overpass `out geom tags` response. */
export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  /** Ways: the node positions. */
  geometry?: (LatLon | null)[];
  /** Ways and relations. */
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  /** Relations: members, with geometry for ways. */
  members?: { type: string; role: string; geometry?: (LatLon | null)[] }[];
  tags?: Record<string, string>;
}

export type VenueShape = { type: 'circle'; radiusM: number } | { type: 'polygon'; rings: Ring[] };

export interface VenueRow {
  sourceId: string;
  name: string;
  category: Category;
  kind: string;
  rank: 1 | 2 | 3;
  /** Representative point: the outline's centroid, or the node itself. */
  lat: number;
  lng: number;
  shape: VenueShape;
  areaM2: number;
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

/** [category, kind in plain words, circle radius in metres when mapped as a point]. */
type Rule = [Category, string, number];

const VENUE_RULES: { key: string; values: Record<string, Rule> }[] = [
  {
    key: 'amenity',
    values: {
      bar: ['nightlife', 'bar', 15],
      pub: ['nightlife', 'pub', 15],
      nightclub: ['nightlife', 'club', 25],
      biergarten: ['nightlife', 'beer garden', 30],
      casino: ['nightlife', 'casino', 30],
      restaurant: ['food', 'restaurant', 15],
      cafe: ['food', 'café', 12],
      fast_food: ['food', 'fast food', 10],
      food_court: ['food', 'food court', 25],
      ice_cream: ['food', 'ice cream', 10],
      marketplace: ['food', 'market', 60],
      theatre: ['sights', 'theatre', 35],
      cinema: ['sights', 'cinema', 30],
      arts_centre: ['sights', 'arts centre', 30],
      library: ['sights', 'library', 30],
      public_bath: ['outdoors', 'pool', 40],
    },
  },
  {
    key: 'tourism',
    values: {
      attraction: ['sights', 'attraction', 30],
      museum: ['sights', 'museum', 35],
      gallery: ['sights', 'gallery', 20],
      viewpoint: ['sights', 'viewpoint', 25],
      aquarium: ['sights', 'aquarium', 40],
      zoo: ['outdoors', 'zoo', 200],
      theme_park: ['outdoors', 'theme park', 150],
    },
  },
  {
    key: 'historic',
    values: {
      castle: ['sights', 'castle', 60],
      palace: ['sights', 'palace', 60],
      monument: ['sights', 'monument', 20],
    },
  },
  {
    key: 'leisure',
    values: {
      park: ['outdoors', 'park', 60],
      garden: ['outdoors', 'garden', 40],
      beach_resort: ['outdoors', 'bathing area', 60],
      water_park: ['outdoors', 'pool', 60],
      stadium: ['sights', 'stadium', 120],
    },
  },
  {
    key: 'shop',
    values: {
      mall: ['sights', 'shopping centre', 60],
    },
  },
  {
    key: 'place',
    values: {
      square: ['sights', 'square', 40],
    },
  },
];

/** Churches and other places of worship count only when they are notable sights. */
const WORSHIP: Rule = ['sights', 'church', 30];

const PLACE_KINDS: Record<string, PlaceRow['kind']> = {
  suburb: 'area',
  quarter: 'area',
  neighbourhood: 'area',
  square: 'landmark',
};

/** Outlines bigger than this are too coarse to say anything about one place. */
const MAX_AREA_M2 = 8_000_000;

/** The Overpass QL query for one bounding box. */
export function overpassQuery([south, west, north, east]: readonly number[]): string {
  const bbox = `${south},${west},${north},${east}`;
  const lines = VENUE_RULES.map(
    (r) => `  nwr["${r.key}"~"^(${Object.keys(r.values).join('|')})$"]["name"](${bbox});`,
  );
  return `[out:json][timeout:120][maxsize:536870912];
(
${lines.join('\n')}
  nwr["amenity"="place_of_worship"]["wikidata"]["name"](${bbox});
  nwr["place"~"^(${Object.keys(PLACE_KINDS).join('|')})$"]["name"](${bbox});
);
out geom tags;`;
}

const toPositions = (g: (LatLon | null)[] | undefined): Position[] =>
  (g ?? []).filter((p): p is LatLon => p !== null).map((p) => [p.lon, p.lat]);

const isClosed = (ring: Position[]) =>
  ring.length >= 4 &&
  ring[0]![0] === ring[ring.length - 1]![0] &&
  ring[0]![1] === ring[ring.length - 1]![1];

/** The outline of a way or multipolygon relation, if it has one. */
function outline(el: OsmElement): Ring[] | null {
  if (el.type === 'way') {
    const ring = toPositions(el.geometry);
    return isClosed(ring) ? [ring] : null;
  }
  if (el.type === 'relation') {
    const outers = (el.members ?? [])
      .filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === ''))
      .map((m) => toPositions(m.geometry));
    return outers.length > 0 ? assembleRings(outers) : null;
  }
  return null;
}

/** Where an element is and how big: outline, or a circle. */
function geometryOf(
  el: OsmElement,
  radiusM: number,
): { lat: number; lng: number; shape: VenueShape; areaM2: number } | null {
  if (el.type === 'node') {
    if (el.lat === undefined || el.lon === undefined) return null;
    return {
      lat: el.lat,
      lng: el.lon,
      shape: { type: 'circle', radiusM },
      areaM2: Math.PI * radiusM * radiusM,
    };
  }

  const rings = outline(el);
  if (rings) {
    const areas = rings.map(ringAreaM2);
    const areaM2 = areas.reduce((a, b) => a + b, 0);
    if (areaM2 > 1 && areaM2 <= MAX_AREA_M2) {
      const largest = rings[areas.indexOf(Math.max(...areas))]!;
      const [lng, lat] = ringCentroid(largest);
      return { lat, lng, shape: { type: 'polygon', rings }, areaM2 };
    }
  }

  // An open way (a pedestrian street) or an outline that would not close:
  // a circle covering its bounds, within reason.
  const b = el.bounds;
  if (!b) return null;
  const center: Position = [(b.minlon + b.maxlon) / 2, (b.minlat + b.maxlat) / 2];
  const half = distanceM([b.minlon, b.minlat], [b.maxlon, b.maxlat]) / 2;
  const r = Math.round(Math.min(Math.max(half, radiusM), 250));
  return {
    lat: center[1],
    lng: center[0],
    shape: { type: 'circle', radiusM: r },
    areaM2: Math.PI * r * r,
  };
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

function ruleFor(tags: Record<string, string>): Rule | null {
  for (const rule of VENUE_RULES) {
    const value = tags[rule.key];
    const hit = value ? rule.values[value] : undefined;
    if (hit) return hit;
  }
  if (tags.amenity === 'place_of_worship' && tags.wikidata) return WORSHIP;
  return null;
}

export function classify(el: OsmElement): { venue?: VenueRow; place?: PlaceRow } {
  const tags = el.tags ?? {};
  const name = tags['name:de'] ?? tags.name;
  if (!name) return {};
  const sourceId = `${el.type}/${el.id}`;
  const out: { venue?: VenueRow; place?: PlaceRow } = {};

  const rule = ruleFor(tags);
  if (rule) {
    const [category, kind, radiusM] = rule;
    const geo = geometryOf(el, radiusM);
    if (geo) out.venue = { sourceId, name, category, kind, rank: rankOf(tags, category), ...geo };
  }

  // Squares are both a place people gather (venue) and a name for the area.
  const placeKind = tags.place ? PLACE_KINDS[tags.place] : undefined;
  if (placeKind) {
    const geo = out.venue ?? geometryOf(el, 0);
    if (geo) out.place = { sourceId, name, kind: placeKind, lat: geo.lat, lng: geo.lng };
  }
  return out;
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

/** EWKT for the database: MULTIPOLYGON for outlines, null for circles. */
export function shapeWkt(shape: VenueShape): string | null {
  if (shape.type !== 'polygon') return null;
  const ring = (r: Ring) => `(${r.map(([x, y]) => `${x} ${y}`).join(',')})`;
  return `SRID=4326;MULTIPOLYGON(${shape.rings.map((r) => `(${ring(r)})`).join(',')})`;
}
