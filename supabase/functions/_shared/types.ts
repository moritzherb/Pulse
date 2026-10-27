/**
 * Types shared by the app and the Edge Functions. Plain TypeScript only: this
 * file is imported by React Native (as @shared/types) and by Deno.
 */

import type { HeatLevel } from './levels.ts';

export type { HeatLevel };

/** H3 resolution of every reported cell: ~460 m edge, ~0.74 km² area. */
export const H3_RESOLUTION = 8;

/** Parent resolution used to group cells into Realtime topics (~8.5 km edge). */
export const REGION_RESOLUTION = 5;

/** Venue categories, derived server-side from OpenStreetMap. Never sent by a phone. */
export type Category = 'nightlife' | 'food' | 'sights' | 'outdoors';

export const CATEGORIES: readonly Category[] = ['nightlife', 'food', 'sights', 'outdoors'];

export type Trend = -1 | 0 | 1;

/**
 * One k-anonymous cell as clients see it. Only cells with at least
 * K_ANONYMITY distinct devices in the window ever exist in this shape.
 */
export interface LiveCell {
  /** H3 index at H3_RESOLUTION. */
  cell: string;
  /** Distinct devices in the window, rounded to the nearest 5. */
  devices: number;
  level: HeatLevel;
  /** Compared with the previous aggregation run. */
  trend: Trend;
  /** Dominant venue category in the cell, if any venues are known. */
  category: Category | null;
  /** Human label: nearest known place name. Null when none is known. */
  label: string | null;
  /** ISO timestamp of the aggregation run that produced this row. */
  updatedAt: string;
}
