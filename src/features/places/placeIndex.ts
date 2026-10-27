import {
  distanceM,
  pointInRing,
  ringCentroid,
  ringsBounds,
  type Position,
  type Ring,
} from '@shared/geometry.ts';

/**
 * The public places of one region, ready to test a position against. Built
 * from venue_shapes() (OpenStreetMap outlines and circles). Pure: no I/O, no
 * storage, so matching can run inside the privacy boundary.
 */

export interface PlaceShape {
  id: number;
  name: string;
  /** Where the place is drawn: the circle centre or the outline's centroid. */
  center: Position;
  areaM2: number;
  /** Outer rings, or null for a circle. */
  rings: Ring[] | null;
  radiusM: number;
  bbox: [number, number, number, number];
}

export interface PlaceIndex {
  region: string;
  places: PlaceShape[];
}

/** venue_shapes() as it arrives over the wire. */
export interface ShapesPayload {
  region: string;
  circles: [id: number, lng: number, lat: number, radiusM: number, name: string][];
  polygons: [id: number, areaM2: number, coordinates: Position[][][], name: string][];
}

const M_PER_DEG_LAT = 110_540;

export function buildPlaceIndex(payload: ShapesPayload): PlaceIndex {
  const places: PlaceShape[] = [];
  for (const [id, lng, lat, radiusM, name] of payload.circles) {
    const dLat = radiusM / M_PER_DEG_LAT;
    const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
    places.push({
      id,
      name,
      center: [lng, lat],
      areaM2: Math.PI * radiusM * radiusM,
      rings: null,
      radiusM,
      bbox: [lng - dLng, lat - dLat, lng + dLng, lat + dLat],
    });
  }
  for (const [id, areaM2, coordinates, name] of payload.polygons) {
    // Outer ring of each polygon; holes (a courtyard) are ignored.
    const rings = coordinates
      .map((polygon) => polygon[0])
      .filter((r): r is Ring => !!r && r.length >= 4);
    if (rings.length === 0) continue;
    places.push({
      id,
      name,
      center: ringCentroid(rings[0]!),
      areaM2,
      rings,
      radiusM: 0,
      bbox: ringsBounds(rings),
    });
  }
  return { region: payload.region, places };
}

function contains(place: PlaceShape, p: Position): boolean {
  const [w, s, e, n] = place.bbox;
  if (p[0] < w || p[0] > e || p[1] < s || p[1] > n) return false;
  if (place.rings) return place.rings.some((r) => pointInRing(p, r));
  return distanceM(place.center, p) <= place.radiusM;
}

/**
 * The place a position is in, or null. When places overlap (a café inside a
 * museum inside a park), the smallest wins: it is the most specific.
 */
export function matchPlace(index: PlaceIndex, p: Position): PlaceShape | null {
  let best: PlaceShape | null = null;
  for (const place of index.places) {
    if ((best === null || place.areaM2 < best.areaM2) && contains(place, p)) best = place;
  }
  return best;
}
