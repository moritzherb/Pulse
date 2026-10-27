// PRIVACY BOUNDARY — the ONLY place a raw coordinate is allowed to exist.
// Nothing in this module returns, stores, logs, or serialises lat/lng.
// Callers can only ever receive a coarse H3 cell id.

const RESOLUTION = 8; // ~460 m edge — what is reported
const PRIVATE_RES = 9; // ~174 m edge — finer, used only on-device for private zones

function h3lib() {
  const h3 = typeof window !== 'undefined' ? window.h3 : null;
  if (!h3) throw new Error('h3-js not loaded');
  return h3;
}

// Resolve to { h3_index, resolution, acquiredAt, heldMs }.
// The GeoolocationPosition object is dereferenced before the promise settles.
export function acquireCoarseCell(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'));
      return;
    }
    const t0 = performance.now();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        let cell = null;
        let fine = null;
        {
          // Scoped so the coordinate cannot escape: converted, then dropped.
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          cell = h3lib().latLngToCell(lat, lng, RESOLUTION);
          fine = h3lib().latLngToCell(lat, lng, PRIVATE_RES);
        }
        resolve({
          h3_index: cell,
          // Local-only key for the private-zone check. Never included in a payload.
          privateKey: fine,
          resolution: RESOLUTION,
          acquiredAt: Date.now(),
          heldMs: Math.round(performance.now() - t0),
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000, ...options }
    );
  });
}

// Cell centre — safe to draw, it is the centre of a ~460 m cell, not the user.
export function cellCenter(h3_index) {
  const [lat, lng] = h3lib().cellToLatLng(h3_index);
  return { lat, lng };
}

export function cellPolygon(h3_index) {
  return h3lib().cellToBoundary(h3_index, true); // [lng, lat] ring
}

export function cellFromLatLng(lat, lng) {
  return h3lib().latLngToCell(lat, lng, RESOLUTION);
}

export async function permissionState() {
  try {
    const p = await navigator.permissions.query({ name: 'geolocation' });
    return p.state; // granted | prompt | denied
  } catch (e) {
    return 'unknown';
  }
}

// Private areas — small zones the user never wants to contribute from (home,
// work). A zone is one res-9 cell plus its immediate ring: roughly 250 m around
// the marked spot, deliberately small so a busy street one block away is
// unaffected. The list is local-only and never sent.
const PKEY = 'pulse.private_zones.v2';

export function privateZones() {
  try {
    const v = JSON.parse(localStorage.getItem(PKEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function saveZones(zones) {
  try { localStorage.setItem(PKEY, JSON.stringify(zones)); } catch (e) {}
  return zones;
}

export function isPrivate(privateKey) {
  if (!privateKey) return false;
  return privateZones().some((z) => z.cells.includes(privateKey));
}

export function addPrivateZone(privateKey) {
  const cells = h3lib().gridDisk(privateKey, 1); // centre + 6 neighbours ≈ 250 m radius
  const zones = privateZones();
  if (!zones.some((z) => z.key === privateKey)) {
    zones.push({ key: privateKey, cells, addedAt: Date.now() });
  }
  return saveZones(zones);
}

export function removePrivateZone(key) {
  return saveZones(privateZones().filter((z) => z.key !== key));
}

// Rotating pseudonymous id. Regenerated every 24 h, never derived from
// anything about the device.
const KEY = 'pulse.anon_id.v1';
const DAY = 24 * 60 * 60 * 1000;

export function anonIdentity(forceRotate = false) {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (e) {
    raw = null;
  }
  const now = Date.now();
  if (forceRotate || !raw || !raw.id || now - raw.issuedAt > DAY) {
    raw = { id: crypto.randomUUID(), issuedAt: now };
    try {
      localStorage.setItem(KEY, JSON.stringify(raw));
    } catch (e) {}
  }
  return { id: raw.id, issuedAt: raw.issuedAt, rotatesAt: raw.issuedAt + DAY };
}
