/**
 * Types shared by the app and the Edge Functions. Plain TypeScript only: this
 * file is imported by React Native (as @shared/types) and by Deno.
 */

import type { HeatLevel } from './levels.ts';

export type { HeatLevel };

/** H3 resolution used to centre the map on the phone's area (~460 m). Never sent. */
export const H3_RESOLUTION = 8;

/** Parent resolution grouping places into regions for downloads and Realtime topics (~250 km²). */
export const REGION_RESOLUTION = 5;

/** Venue categories, derived server-side from OpenStreetMap. Never sent by a phone. */
export type Category = 'nightlife' | 'food' | 'sights' | 'outdoors';

export const CATEGORIES: readonly Category[] = ['nightlife', 'food', 'sights', 'outdoors'];

export type Trend = -1 | 0 | 1;

/**
 * One k-anonymous place as clients see it. Only places with at least
 * K_ANONYMITY distinct devices in the window ever exist in this shape.
 * Name, category, kind and position are public OpenStreetMap data.
 */
export interface LivePlace {
  id: number;
  name: string;
  category: Category;
  /** The OSM type in plain words ("café", "museum"). */
  kind: string | null;
  lng: number;
  lat: number;
  /** Distinct devices in the window, rounded to the nearest 5. */
  devices: number;
  /** Against the place's usual peak once it has history. */
  level: HeatLevel;
  /** Newer vs older half of the window. */
  trend: Trend;
  /** ISO timestamp of the aggregation run that produced this row. */
  updatedAt: string;
}
