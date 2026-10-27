import { latLngToCell } from 'h3-js';

import { cellCenter, cellRing, cellsToPoints, cellsToPolygons, isReportableCell } from '@/lib/h3';
import type { LiveCell } from '@shared/types.ts';

const STEPHANSPLATZ = latLngToCell(48.2082, 16.3738, 8);

const cell: LiveCell = {
  cell: STEPHANSPLATZ,
  devices: 25,
  level: 'busy',
  trend: 1,
  category: 'sights',
  label: 'Stephansplatz',
  updatedAt: '2026-10-27T10:00:00.000Z',
};

describe('h3 helpers', () => {
  it('accepts only resolution-8 cells as reportable', () => {
    expect(isReportableCell(STEPHANSPLATZ)).toBe(true);
    expect(isReportableCell(latLngToCell(48.2082, 16.3738, 9))).toBe(false);
    expect(isReportableCell('not-a-cell')).toBe(false);
  });

  it('returns centres in [lng, lat] order near the input point', () => {
    const [lng, lat] = cellCenter(STEPHANSPLATZ);
    expect(lng).toBeCloseTo(16.37, 1);
    expect(lat).toBeCloseTo(48.21, 1);
  });

  it('builds closed hexagon rings', () => {
    const ring = cellRing(STEPHANSPLATZ);
    expect(ring).toHaveLength(7);
    expect(ring[0]).toEqual(ring[6]);
  });

  it('builds GeoJSON with the properties the layers read', () => {
    const polys = cellsToPolygons([cell]);
    const pts = cellsToPoints([cell]);
    expect(polys.features[0]?.properties).toMatchObject({
      cell: STEPHANSPLATZ,
      level: 'busy',
      devices: 25,
    });
    expect(pts.features[0]?.geometry.type).toBe('Point');
  });
});
