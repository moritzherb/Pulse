import { cellToLatLng } from 'h3-js';

/** [longitude, latitude], the order MapLibre and GeoJSON use. */
export type LngLat = [number, number];

/**
 * Centre of a cell. Safe to draw or fly to: it is the middle of a ~460 m
 * hexagon, not anyone's position. Used to centre the map on the phone's area.
 */
export function cellCenter(cell: string): LngLat {
  const [lat, lng] = cellToLatLng(cell);
  return [lng, lat];
}
