import { createStore } from '@/lib/createStore';
import { readJson, StorageKeys, writeJson } from '@/lib/storage';

/**
 * Consent state. One purpose only: sharing the place the phone is at. Browsing
 * the map needs no consent at all.
 *
 * Stored with the policy version it was given under. When the version
 * changes (EXPO_PUBLIC_POLICY_VERSION), the consent screen is shown again.
 */

export const POLICY_VERSION = process.env.EXPO_PUBLIC_POLICY_VERSION ?? '2026-10-28';

export interface ConsentState {
  /** The policy version this decision was made under. */
  policyVersion: string;
  /** True once the person picked "Share anonymously" or "Just browse". */
  decided: boolean;
  /** Share my area. */
  location: boolean;
  /** ISO time location sharing was last switched on, for the Settings stamp. */
  locationGrantedAt: string | null;
}

const EMPTY: ConsentState = {
  policyVersion: POLICY_VERSION,
  decided: false,
  location: false,
  locationGrantedAt: null,
};

function load(): ConsentState {
  const saved = readJson<ConsentState | null>(StorageKeys.consent, null);
  if (!saved || saved.policyVersion !== POLICY_VERSION) return EMPTY;
  return saved;
}

export const consentStore = createStore<ConsentState>(load());

function save(next: ConsentState) {
  consentStore.set(next);
  writeJson(StorageKeys.consent, next);
}

/** "Share anonymously" or "Just browse" on the consent screen. */
export function decide(shareLocation: boolean) {
  save({
    policyVersion: POLICY_VERSION,
    decided: true,
    location: shareLocation,
    locationGrantedAt: shareLocation ? new Date().toISOString() : null,
  });
}

/** The Settings switch. Switching off also deletes outstanding pings (Phase 2). */
export function setLocationSharing(on: boolean) {
  const prev = consentStore.get();
  save({
    ...prev,
    decided: true,
    location: on,
    locationGrantedAt: on ? new Date().toISOString() : prev.locationGrantedAt,
  });
}

/** Back to a fresh install. Used by "Delete my data". */
export function resetConsent() {
  save(EMPTY);
}

export const useConsent = () => consentStore.use();
