import { changedCells } from '@/components/map/levelChanges';
import type { LiveCell } from '@shared/types.ts';

const cell = (id: string, level: LiveCell['level'], devices = 10): LiveCell => ({
  cell: id,
  devices,
  level,
  trend: 0,
  category: null,
  label: null,
  updatedAt: '',
});

describe('changedCells', () => {
  it('returns cells that changed level or vanished, in their old state', () => {
    const prev = [cell('a', 'quiet'), cell('b', 'busy'), cell('c', 'packed')];
    const next = [cell('a', 'quiet', 9), cell('b', 'packed'), cell('d', 'quiet')];
    expect(changedCells(prev, next).map((c) => [c.cell, c.level])).toEqual([
      ['b', 'busy'],
      ['c', 'packed'],
    ]);
  });

  it('ignores count changes within a level', () => {
    expect(changedCells([cell('a', 'busy', 20)], [cell('a', 'busy', 30)])).toEqual([]);
  });
});
