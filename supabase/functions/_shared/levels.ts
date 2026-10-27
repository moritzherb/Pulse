/**
 * Crowd levels, shared by the app and the Edge Functions so both sides agree.
 * The database mirrors these thresholds in `public.level_for()` and
 * `public.level_for_place()`; a unit test keeps them in sync.
 */

export type HeatLevel = 'quiet' | 'moderate' | 'busy' | 'packed';

export const HEAT_LEVELS: readonly HeatLevel[] = ['quiet', 'moderate', 'busy', 'packed'];

/** Minimum k-anonymity: a place is never shown below this many distinct devices. */
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

/**
 * Share of a place's usual peak at which each level starts. Busy means busy
 * for this place: a café and a park are each judged on their own scale, and
 * the level does not depend on how many people use Pulse.
 */
export const PEAK_SHARE: Record<Exclude<HeatLevel, 'quiet'>, number> = {
  moderate: 0.35,
  busy: 0.6,
  packed: 0.85,
};

/** Below this usual peak there is too little history to compare against. */
export const MIN_USUAL_PEAK = 10;

/**
 * Level of a place: against its usual peak once it has history, otherwise
 * the fixed thresholds of levelForDevices().
 */
export function levelForPlace(devices: number, usualPeak: number | null): HeatLevel {
  if (usualPeak === null || usualPeak < MIN_USUAL_PEAK) return levelForDevices(devices);
  if (devices >= usualPeak * PEAK_SHARE.packed) return 'packed';
  if (devices >= usualPeak * PEAK_SHARE.busy) return 'busy';
  if (devices >= usualPeak * PEAK_SHARE.moderate) return 'moderate';
  return 'quiet';
}

/** Server stores levels as 1..4. */
export function levelFromRank(rank: number): HeatLevel {
  return HEAT_LEVELS[Math.min(Math.max(rank, 1), 4) - 1] ?? 'quiet';
}
