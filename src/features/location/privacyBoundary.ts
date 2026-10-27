import * as Location from 'expo-location';
import { cellToParent, latLngToCell } from 'h3-js';

import { matchPlace, type PlaceIndex } from '@/features/places/placeIndex';
import { H3_RESOLUTION, REGION_RESOLUTION } from '@shared/types.ts';

/**
 * PRIVACY BOUNDARY. The only module allowed to read the device position.
 *
 * A coordinate exists here for the few microseconds it takes to turn it into
 * H3 cells and to look up the public place it falls in. It is never returned,
 * stored, logged or serialised. Callers only ever receive cell ids and, at
 * most, the id of a public place (a café, a park). A lint rule
 * (no-restricted-imports) stops any other file from importing expo-location.
 */

/** Finer, on-device-only resolution for the "private areas" check (~174 m edge). */
const PRIVATE_RESOLUTION = 9;

export interface CoarseFix {
  /** Cell at H3_RESOLUTION (~460 m). Only used to centre the map; never sent. */
  cell: string;
  /** Finer cell for the local private-area check. Never included in a payload. */
  privateKey: string;
  /** How long the raw position existed in memory before being dropped, in ms. */
  heldMs: number;
  acquiredAt: number;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function permissionState(): Promise<PermissionState> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED
    ? 'granted'
    : status === Location.PermissionStatus.DENIED
      ? 'denied'
      : 'undetermined';
}

/**
 * Ask iOS / Android for foreground location. Only ever called after the
 * person made a choice on the consent screen, or tapped "locate me".
 */
export async function requestPermission(): Promise<PermissionState> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED ? 'granted' : 'denied';
}

/** Read the position once, convert it to cells, drop it. */
export async function acquireCoarseFix(): Promise<CoarseFix> {
  const t0 = Date.now();
  const position = await Location.getCurrentPositionAsync({
    // ~100 m is plenty to land in the right 460 m cell and is gentler on battery.
    accuracy: Location.Accuracy.Balanced,
  });
  let cell: string;
  let privateKey: string;
  {
    // Scoped so the coordinate cannot escape this block.
    const { latitude, longitude } = position.coords;
    cell = latLngToCell(latitude, longitude, H3_RESOLUTION);
    privateKey = latLngToCell(latitude, longitude, PRIVATE_RESOLUTION);
  }
  return { cell, privateKey, heldMs: Date.now() - t0, acquiredAt: Date.now() };
}

/** A position is only matched to a place when the phone knows it this well. */
export const PLACE_ACCURACY_M = 50;

/** The public place the phone is at, as far as the phone can tell. */
export interface PlaceFix {
  /** Region (H3 resolution 5, ~250 km²) whose place outlines are needed. */
  region: string;
  /** Finer cell for the local private-area check. Never included in a payload. */
  privateKey: string;
  /** The place, or null when the phone is not at one. The id is the only thing ever sent. */
  place: { id: number; name: string; center: [number, number] } | null;
  /** False when the position is too rough (Precise Location off, indoors) to name a place. */
  precise: boolean;
  /** False when the outlines for `region` are not on the phone yet. */
  indexReady: boolean;
  heldMs: number;
  acquiredAt: number;
}

type IndexLookup = (region: string) => PlaceIndex | null;

function toPlaceFix(position: Location.LocationObject, lookup: IndexLookup, t0: number): PlaceFix {
  let region: string;
  let privateKey: string;
  let place: PlaceFix['place'] = null;
  let precise: boolean;
  let indexReady: boolean;
  {
    // Scoped so the coordinate cannot escape this block.
    const { latitude, longitude, accuracy } = position.coords;
    privateKey = latLngToCell(latitude, longitude, PRIVATE_RESOLUTION);
    region = cellToParent(privateKey, REGION_RESOLUTION);
    precise = accuracy !== null && accuracy <= PLACE_ACCURACY_M;
    const index = lookup(region);
    indexReady = index !== null;
    const hit = index && precise ? matchPlace(index, [longitude, latitude]) : null;
    if (hit) place = { id: hit.id, name: hit.name, center: hit.center };
  }
  return {
    region,
    privateKey,
    place,
    precise,
    indexReady,
    heldMs: Date.now() - t0,
    acquiredAt: Date.now(),
  };
}

/**
 * Read the position once and find the public place it is in, using the
 * outlines already on the phone. The position is dropped before returning.
 */
export async function acquirePlaceFix(lookup: IndexLookup): Promise<PlaceFix> {
  const t0 = Date.now();
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return toPlaceFix(position, lookup, t0);
}

/**
 * Watch for the phone arriving at, leaving or moving between places while
 * the app is open. Only hears about a change of place (or region), never
 * about a position. Foreground only.
 */
export async function watchPlace(
  lookup: IndexLookup,
  onChange: (fix: PlaceFix) => void,
): Promise<() => void> {
  let last: string | null = null;
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 30_000 },
    (position) => {
      const fix = toPlaceFix(position, lookup, Date.now());
      const key = `${fix.region}:${fix.place?.id ?? '-'}:${fix.precise}`;
      if (key === last) return;
      last = key;
      onChange(fix);
    },
  );
  return () => subscription.remove();
}
