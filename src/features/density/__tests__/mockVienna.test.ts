import { getResolution } from 'h3-js';

import { buildMockVienna } from '@/features/density/mockVienna';
import { K_ANONYMITY, levelForDevices } from '@shared/levels.ts';

describe('mock Vienna data', () => {
  const cells = buildMockVienna(new Date('2026-10-27T18:00:00Z'));

  it('obeys the same rules as the server', () => {
    expect(cells.length).toBeGreaterThan(10);
    for (const c of cells) {
      expect(getResolution(c.cell)).toBe(8);
      expect(c.devices).toBeGreaterThanOrEqual(K_ANONYMITY);
      expect(c.devices % 5).toBe(0);
      expect(c.level).toBe(levelForDevices(c.devices));
      expect([-1, 0, 1]).toContain(c.trend);
    }
  });

  it('has unique cells, busiest first, with Stephansplatz on top', () => {
    expect(new Set(cells.map((c) => c.cell)).size).toBe(cells.length);
    const counts = cells.map((c) => c.devices);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(cells[0]?.label).toBe('Stephansplatz');
    expect(cells[0]?.level).toBe('packed');
  });

  it('is deterministic', () => {
    expect(buildMockVienna(new Date('2026-10-27T18:00:00Z'))).toEqual(cells);
  });
});
