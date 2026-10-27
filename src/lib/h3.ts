import { cellToBoundary, cellToLatLng, getResolution, isValidCell } from 'h3-js';

import { H3_RESOLUTION, type LiveCell } from '@shared/types.ts';

/** [longitude, latitude], the order MapLibre and GeoJSON use. */
export type LngLat = [number, number];

/**
 * Centre of a cell. Safe to draw or fly to: it is the middle of a ~460 m
 * hexagon, not anyone's position.
 */
export function cellCenter(cell: string): LngLat {
  const [lat, lng] = cellToLatLng(cell);
  return [lng, lat];
}

/** Closed polygon ring in [lng, lat] order. */
export function cellRing(cell: string): LngLat[] {
  return cellToBoundary(cell, true) as LngLat[];
}

/** True for a well-formed H3 index at the app's reporting resolution. */
export function isReportableCell(cell: string): boolean {
  return isValidCell(cell) && getResolution(cell) === H3_RESOLUTION;
}

export interface CellFeatureProps {
  cell: string;
  devices: number;
  level: LiveCell['level'];
  trend: LiveCell['trend'];
  category: string;
  label: string;
}

/** Hexagon polygons for the street-level layer. */
export function cellsToPolygons(
  cells: readonly LiveCell[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon, CellFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: cells.map((c) => ({
      type: 'Feature',
      id: c.cell,
      properties: toProps(c),
      geometry: { type: 'Polygon', coordinates: [cellRing(c.cell)] },
    })),
  };
}

/** Cell centres for the city-level blurred heatmap. */
export function cellsToPoints(
  cells: readonly LiveCell[],
): GeoJSON.FeatureCollection<GeoJSON.Point, CellFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: cells.map((c) => ({
      type: 'Feature',
      id: c.cell,
      properties: toProps(c),
      geometry: { type: 'Point', coordinates: cellCenter(c.cell) },
    })),
  };
}

function toProps(c: LiveCell): CellFeatureProps {
  return {
    cell: c.cell,
    devices: c.devices,
    level: c.level,
    trend: c.trend,
    category: c.category ?? '',
    label: c.label ?? '',
  };
}
