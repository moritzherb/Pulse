import * as Location from 'expo-location';
import { latLngToCell } from 'h3-js';

import { H3_RESOLUTION } from '@shared/types.ts';

/**
 * PRIVACY BOUNDARY. The only module allowed to read the device position.
 *
 * A coordinate exists here for the few microseconds it takes to turn it into
 * H3 cells. It is never returned, stored, logged or serialised. Callers can
 * only ever receive cell ids. A lint rule (no-restricted-imports) stops any
 * other file from importing expo-location.
 */

/** Finer, on-device-only resolution for the "private areas" check (~174 m edge). */
const PRIVATE_RESOLUTION = 9;

export interface CoarseFix {
  /** Reportable cell at H3_RESOLUTION (~460 m). The only thing ever sent. */
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
