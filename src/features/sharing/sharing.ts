import { recordConsent, ensureIdentity } from '@/features/identity/identity';
import { acquirePlaceFix, type PlaceFix } from '@/features/location/privacyBoundary';
import { isPrivate } from '@/features/location/privateZones';
import { cachedPlaceIndex, loadPlaceIndex } from '@/features/places/placeShapes';
import { createStore } from '@/lib/createStore';
import { supabase } from '@/lib/supabase';

/**
 * Sharing state and the single code path that sends a ping.
 *
 * What leaves the phone: `{ "venue": <id> }`, the public place (café, park,
 * museum) the phone is at, plus the anonymous session token. Nothing else:
 * no coordinates, no time (the server sets it), no device identifier. When
 * the phone is not at a place, nothing is sent at all.
 */

/** How often the app reports while open and sharing (design: "every 3 min"). */
export const PING_INTERVAL_MS = 3 * 60_000;
/** A place counts only after the phone has stayed there this long, so walking past doesn't. */
export const DWELL_MS = 2 * 60_000;
/** The server refuses pings closer together than this; don't bother sending them. */
const MIN_GAP_MS = 60_000;

export type SharingStatus =
  | 'off' // consent not given or withdrawn
  | 'sharing' // at a place and reporting it
  | 'arriving' // at a place, counted once the dwell time has passed
  | 'away' // not at any place on the map: nothing is sent
  | 'preparing' // the places of this region are still being imported: nothing is sent yet
  | 'imprecise' // position too rough to name a place (Precise Location off): nothing is sent
  | 'paused' // inside a private area: nothing is sent
  | 'unavailable' // OS location permission denied
  | 'offline'; // sharing on, but the server could not be reached

export interface MyPlace {
  id: number;
  name: string;
  /** The place's own position (public), never the phone's. */
  center: [number, number];
}

export interface SharingState {
  status: SharingStatus;
  /** The place the phone is at, while sharing. Shown as the "me" dot. */
  myPlace: MyPlace | null;
  lastSentAt: number | null;
  /** Raw pings currently stored for this identity (all expire within 20 min). */
  outstanding: number;
  /** How long the last raw position existed in memory, in ms. */
  heldMs: number | null;
}

const INITIAL: SharingState = {
  status: 'off',
  myPlace: null,
  lastSentAt: null,
  outstanding: 0,
  heldMs: null,
};

export const sharingStore = createStore<SharingState>(INITIAL);
export const useSharing = () => sharingStore.use();

const patch = (p: Partial<SharingState>) => sharingStore.set((s) => ({ ...s, ...p }));

let inFlight = false;
/** The place the phone has been at since `since`, for the dwell rule. */
let arrival: { id: number; since: number } | null = null;
let dwellTimer: ReturnType<typeof setTimeout> | undefined;

function leave(status: SharingStatus, heldMs: number) {
  arrival = null;
  clearTimeout(dwellTimer);
  patch({ status, myPlace: null, heldMs });
}

/**
 * Find the place, downloading the region's outlines once if needed.
 * 'preparing' while the server is still importing the region.
 */
async function locate(fix?: PlaceFix): Promise<PlaceFix | 'preparing'> {
  const f = fix ?? (await acquirePlaceFix(cachedPlaceIndex));
  if (f.indexReady) return f;
  const index = await loadPlaceIndex(f.region);
  if (index === 'pending') return 'preparing';
  if (!index) throw new Error('place outlines unavailable');
  return acquirePlaceFix(cachedPlaceIndex);
}

/** Check where the phone is and send a ping if it has been at a place long enough. */
export async function sendPing(fix?: PlaceFix): Promise<void> {
  if (inFlight || !supabase) {
    if (!supabase) patch({ status: 'offline' });
    return;
  }
  inFlight = true;
  try {
    const f = await locate(fix);
    if (f === 'preparing') return leave('preparing', sharingStore.get().heldMs ?? 0);
    if (isPrivate(f.privateKey)) return leave('paused', f.heldMs);
    if (!f.precise) return leave('imprecise', f.heldMs);
    if (!f.place) return leave('away', f.heldMs);

    const now = Date.now();
    if (arrival?.id !== f.place.id) {
      arrival = { id: f.place.id, since: now };
      clearTimeout(dwellTimer);
      dwellTimer = setTimeout(() => sendPing(), DWELL_MS + 1_000);
    }
    if (now - arrival.since < DWELL_MS) {
      patch({ status: 'arriving', myPlace: f.place, heldMs: f.heldMs });
      return;
    }

    const last = sharingStore.get().lastSentAt;
    if (last && now - last < MIN_GAP_MS) return;

    await ensureIdentity();
    const { error } = await supabase.functions.invoke('ping', { body: { venue: f.place.id } });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      // 425: identity still too new; 429: too soon. Both retry on the next tick.
      if (status === 425 || status === 429) {
        patch({ status: 'sharing', myPlace: f.place });
        return;
      }
      throw error;
    }
    patch({ status: 'sharing', myPlace: f.place, lastSentAt: Date.now(), heldMs: f.heldMs });
    await refreshOutstanding();
  } catch {
    patch({ status: 'offline' });
  } finally {
    inFlight = false;
  }
}

/** Ask the server how many raw pings are stored for this identity. */
export async function refreshOutstanding(): Promise<void> {
  if (!supabase) return;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return patch({ outstanding: 0 });
  const { data } = await supabase.rpc('my_outstanding_pings');
  if (typeof data === 'number') patch({ outstanding: data });
}

/**
 * Sharing switched off: record the withdrawal and delete what was already
 * sent. Returns the number of pings deleted.
 */
export async function withdraw(): Promise<number> {
  leave('off', sharingStore.get().heldMs ?? 0);
  await recordConsent(false);
  return deleteSentPings();
}

/** Delete every raw ping this identity has sent. Returns how many were removed. */
export async function deleteSentPings(): Promise<number> {
  if (!supabase) return 0;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return 0;
  const { data } = await supabase.rpc('delete_my_pings');
  patch({ outstanding: 0, myPlace: null });
  return typeof data === 'number' ? data : 0;
}

/** Status changes driven by consent, OS permission and the app going to the background. */
export function setSharingStatus(status: SharingStatus) {
  if (status === 'off' || status === 'unavailable') {
    arrival = null;
    clearTimeout(dwellTimer);
    patch({ status, myPlace: null });
  } else {
    patch({ status });
  }
}

/** Stop the dwell timer (app in background): staying counts again from the next visit. */
export function pauseSharing() {
  arrival = null;
  clearTimeout(dwellTimer);
}

/** Back to a fresh install (Delete my data). */
export function resetSharing() {
  pauseSharing();
  sharingStore.set(INITIAL);
}
