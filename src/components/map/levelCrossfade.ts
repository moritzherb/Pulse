import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import type { LiveCell } from '@shared/types.ts';

import { changedCells } from './levelChanges';

export interface Ghost {
  cells: LiveCell[];
  /** False for one frame (old look fully visible), then true (fading out). */
  fading: boolean;
  /** Bumps on every new change set, so the fade restarts. */
  generation: number;
}

/**
 * Smooth level changes on the map. When live data arrives, cells that change
 * level are first drawn in their old colour on top, then faded out with a
 * native MapLibre paint transition. Disabled with Reduce Motion.
 */
export function useLevelCrossfade(cells: readonly LiveCell[]): Ghost {
  const reduceMotion = useReducedMotion();
  const [prev, setPrev] = useState(cells);
  const [ghost, setGhost] = useState<Ghost>({ cells: [], fading: true, generation: 0 });

  // Derive from the previous render instead of an effect (React's
  // "storing information from previous renders" pattern).
  if (cells !== prev) {
    setPrev(cells);
    const changed = reduceMotion ? [] : changedCells(prev, cells);
    if (changed.length > 0) {
      setGhost((g) => ({ cells: changed, fading: false, generation: g.generation + 1 }));
    }
  }

  useEffect(() => {
    if (ghost.fading) return;
    // One frame with the old look at full strength, then start the fade.
    const t = setTimeout(() => setGhost((g) => ({ ...g, fading: true })), 48);
    return () => clearTimeout(t);
  }, [ghost]);

  return ghost;
}
