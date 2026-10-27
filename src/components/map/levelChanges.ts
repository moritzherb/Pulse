import type { LiveCell } from '@shared/types.ts';

/**
 * Cells whose look changes between two snapshots: the level changed, or the
 * cell disappeared (fell under k). Returned in their *previous* state, so
 * they can be drawn on top and faded out to reveal the new state.
 */
export function changedCells(prev: readonly LiveCell[], next: readonly LiveCell[]): LiveCell[] {
  const nextLevel = new Map(next.map((c) => [c.cell, c.level]));
  return prev.filter((c) => nextLevel.get(c.cell) !== c.level);
}
