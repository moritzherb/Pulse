import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useConsent } from '@/features/consent/consent';
import {
  permissionState,
  watchPlace,
  type PermissionState,
} from '@/features/location/privacyBoundary';
import { cachedPlaceIndex } from '@/features/places/placeShapes';

import { pauseSharing, PING_INTERVAL_MS, sendPing, setSharingStatus } from './sharing';

/**
 * Runs the ping loop while, and only while, all of these hold:
 *   - the person chose to share,
 *   - the OS grants foreground location,
 *   - the app is in the foreground.
 * Checks on start, every 3 minutes, and when the phone arrives at, leaves or
 * changes place; a ping goes out only after two minutes at the same place.
 * Renders nothing.
 */
export function SharingEngine() {
  const consent = useConsent();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // Re-check permission whenever it could have changed (consent, return from Settings app).
  useEffect(() => {
    if (!consent.location || !appActive) return;
    permissionState().then(setPermission);
  }, [consent.location, appActive]);

  const active = consent.decided && consent.location && appActive && permission === 'granted';

  useEffect(() => {
    if (!consent.location) setSharingStatus('off');
    else if (permission === 'denied') setSharingStatus('unavailable');
  }, [consent.location, permission]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stopWatching: (() => void) | null = null;

    sendPing();
    const timer = setInterval(() => sendPing(), PING_INTERVAL_MS);
    watchPlace(cachedPlaceIndex, (fix) => sendPing(fix))
      .then((stop) => {
        if (cancelled) stop();
        else stopWatching = stop;
      })
      .catch(() => {
        // Watching is a nicety; the 3-minute timer still runs.
      });

    return () => {
      cancelled = true;
      clearInterval(timer);
      stopWatching?.();
      pauseSharing();
    };
  }, [active]);

  return null;
}
