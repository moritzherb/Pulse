/**
 * Crowd levels, shared by the app and the Edge Functions so both sides agree.
 * The database mirrors these thresholds in `public.level_for()`; a unit test
 * keeps them in sync.
 */

export type HeatLevel = 'quiet' | 'moderate' | 'busy' | 'packed';

export const HEAT_LEVELS: readonly HeatLevel[] = ['quiet', 'moderate', 'busy', 'packed'];

/** Minimum k-anonymity: a cell is never shown below this many distinct devices. */
export const K_ANONYMITY = 5;

/** Lowest rounded device count for each level. */
export const LEVEL_MIN_DEVICES: Record<HeatLevel, number> = {
  quiet: K_ANONYMITY,
  moderate: 10,
  busy: 20,
  packed: 35,
};

/** Map an approximate device count (already >= K) to its level. */
export function levelForDevices(devices: number): HeatLevel {
  if (devices >= LEVEL_MIN_DEVICES.packed) return 'packed';
  if (devices >= LEVEL_MIN_DEVICES.busy) return 'busy';
  if (devices >= LEVEL_MIN_DEVICES.moderate) return 'moderate';
  return 'quiet';
}

/** Server stores levels as 1..4. */
export function levelFromRank(rank: number): HeatLevel {
  return HEAT_LEVELS[Math.min(Math.max(rank, 1), 4) - 1] ?? 'quiet';
}
