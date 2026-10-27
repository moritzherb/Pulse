/**
 * Small, dependency-free geometry for place outlines. Used on the phone to
 * find the place it is in, and by the OpenStreetMap importer to measure
 * outlines. Places are at most a few kilometres across, so a local flat
 * projection around each shape is accurate to well under a metre.
 *
 * Imported by relative path from scripts/, so no path aliases here.
 */

/** [longitude, latitude], the GeoJSON order. */
export type Position = [number, number];
/** A closed ring: first and last position are equal. */
export type Ring = Position[];

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Distance in metres between two nearby points. */
export function distanceM(a: Position, b: Position): number {
  const dx = (b[0] - a[0]) * mPerDegLng((a[1] + b[1]) / 2);
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Signed shoelace sum of a ring in local metres around its first point. */
function shoelace(ring: Ring): { area: number; cx: number; cy: number } {
  const origin = ring[0];
  if (!origin || ring.length < 4) return { area: 0, cx: 0, cy: 0 };
  const kx = mPerDegLng(origin[1]);
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const p = ring[i]!;
    const q = ring[i + 1]!;
    const x1 = (p[0] - origin[0]) * kx;
    const y1 = (p[1] - origin[1]) * M_PER_DEG_LAT;
    const x2 = (q[0] - origin[0]) * kx;
    const y2 = (q[1] - origin[1]) * M_PER_DEG_LAT;
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return { area: a / 2, cx, cy };
}

/** Area of a ring in square metres. */
export function ringAreaM2(ring: Ring): number {
  return Math.abs(shoelace(ring).area);
}

/** Centroid of a ring. Falls back to the first point for degenerate rings. */
export function ringCentroid(ring: Ring): Position {
  const origin = ring[0];
  if (!origin) return [0, 0];
  const { area, cx, cy } = shoelace(ring);
  if (Math.abs(area) < 1e-6) return origin;
  return [
    origin[0] + cx / (6 * area) / mPerDegLng(origin[1]),
    origin[1] + cy / (6 * area) / M_PER_DEG_LAT,
  ];
}

/** Even-odd test: is the point inside the ring? */
export function pointInRing(p: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Bounding box [west, south, east, north] of some rings. */
export function ringsBounds(rings: readonly Ring[]): [number, number, number, number] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
  }
  return [w, s, e, n];
}

const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];

/**
 * Join the outer ways of an OpenStreetMap multipolygon into closed rings.
 * Ways may run in either direction. Returns null when they do not close.
 */
export function assembleRings(ways: readonly Position[][]): Ring[] | null {
  const open = ways.filter((w) => w.length >= 2).map((w) => [...w]);
  const rings: Ring[] = [];
  while (open.length > 0) {
    let ring = open.shift()!;
    let grew = true;
    while (!same(ring[0]!, ring[ring.length - 1]!) && grew) {
      grew = false;
      const end = ring[ring.length - 1]!;
      for (let i = 0; i < open.length; i++) {
        const w = open[i]!;
        if (same(w[0]!, end)) ring = ring.concat(w.slice(1));
        else if (same(w[w.length - 1]!, end)) ring = ring.concat([...w].reverse().slice(1));
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (!same(ring[0]!, ring[ring.length - 1]!) || ring.length < 4) return null;
    rings.push(ring);
  }
  return rings.length > 0 ? rings : null;
}
