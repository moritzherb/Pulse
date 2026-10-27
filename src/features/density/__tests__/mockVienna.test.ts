import { getResolution } from 'h3-js';

import { buildMockVienna, mockCellDetail } from '@/features/density/mockVienna';
import { simulatedCells } from '@/features/density/simulation';
import { K_ANONYMITY, levelForDevices } from '@shared/levels.ts';

// Saturday 31 Oct 2026, 14:00 in Vienna (CET, UTC+1): a busy afternoon.
const SATURDAY_AFTERNOON = new Date('2026-10-31T13:00:00Z');
// Tuesday 27 Oct 2026, 04:00 in Vienna: almost nobody around.
const TUESDAY_NIGHT = new Date('2026-10-27T03:00:00Z');

describe('simulated Vienna feed', () => {
  const cells = buildMockVienna(SATURDAY_AFTERNOON);

  it('obeys the same rules as the server', () => {
    expect(cells.length).toBeGreaterThan(20);
    for (const c of cells) {
      expect(getResolution(c.cell)).toBe(8);
      expect(c.devices).toBeGreaterThanOrEqual(K_ANONYMITY);
      expect(c.devices % 5).toBe(0);
      expect(c.level).toBe(levelForDevices(c.devices));
    }
  });

  it('has every level on a busy afternoon, busiest first', () => {
    expect(new Set(cells.map((c) => c.level))).toEqual(
      new Set(['quiet', 'moderate', 'busy', 'packed']),
    );
    const counts = cells.map((c) => c.devices);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('follows the clock: the city is quiet before dawn', () => {
    expect(buildMockVienna(TUESDAY_NIGHT).length).toBeLessThan(cells.length / 3);
  });

  it('is deterministic', () => {
    expect(buildMockVienna(SATURDAY_AFTERNOON)).toEqual(cells);
  });

  it('builds a detail payload with a full week of history', () => {
    const top = cells[0]!;
    const detail = mockCellDetail(top.cell, SATURDAY_AFTERNOON);
    expect(detail.live?.devices).toBe(top.devices);
    expect(detail.usual.hours).toHaveLength(7 * 24);
    expect(detail.label).toBe(simulatedCells().find((c) => c.cell === top.cell)?.main.name);
  });
});
