import { gridDisk } from 'h3-js';

import { createStore } from '@/lib/createStore';
import { readJson, StorageKeys, writeJson } from '@/lib/storage';

/**
 * Private areas (design: "Never share where I am now"). A zone is one ~174 m
 * cell plus its six neighbours, roughly 250 m around the marked spot: small
 * enough that a busy street a block away still counts. Stored only on this
 * phone and never sent anywhere.
 */
export interface PrivateZone {
  key: string;
  cells: string[];
  addedAt: number;
}

export const privateZonesStore = createStore<PrivateZone[]>(
  readJson<PrivateZone[]>(StorageKeys.privateZones, []),
);

function save(zones: PrivateZone[]) {
  privateZonesStore.set(zones);
  writeJson(StorageKeys.privateZones, zones);
}

export function addPrivateZone(privateKey: string) {
  const zones = privateZonesStore.get();
  if (zones.some((z) => z.key === privateKey)) return;
  save([...zones, { key: privateKey, cells: gridDisk(privateKey, 1), addedAt: Date.now() }]);
}

export function removePrivateZone(key: string) {
  save(privateZonesStore.get().filter((z) => z.key !== key));
}

/** Remove every zone. Used by "Delete my data". */
export function clearPrivateZones() {
  save([]);
}

/** True when the fine cell falls in any marked zone. Nothing is sent from there. */
export function isPrivate(privateKey: string): boolean {
  return privateZonesStore.get().some((z) => z.cells.includes(privateKey));
}

export const usePrivateZones = () => privateZonesStore.use();
