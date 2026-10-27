import Storage from 'expo-sqlite/kv-store';

/**
 * Local key-value storage for preferences, consent state and the anonymous
 * session.
 *
 * Deliberately not the iOS Keychain (expo-secure-store): Keychain entries
 * survive uninstalling the app, which would silently keep the anonymous ID
 * alive. This store lives in the app sandbox and is wiped on uninstall.
 */

/** All keys the app writes, in one place so "delete my data" can clear them. */
export const StorageKeys = {
  themePreference: 'pulse.theme.v1',
  consent: 'pulse.consent.v1',
  privateZones: 'pulse.private_zones.v1',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/** Read and parse a JSON value synchronously. Returns `fallback` on any error. */
export function readJson<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = Storage.getItemSync(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Serialise and write a JSON value synchronously. */
export function writeJson(key: StorageKey, value: unknown): void {
  try {
    Storage.setItemSync(key, JSON.stringify(value));
  } catch {
    // Storage failures are non-fatal: the app keeps working with in-memory state.
  }
}

export function removeKey(key: StorageKey): void {
  try {
    Storage.removeItemSync(key);
  } catch {
    // ignore
  }
}

/** Everything this app stores locally. Used by "Delete my data". */
export async function clearAll(): Promise<void> {
  await Storage.clearAsync();
}
