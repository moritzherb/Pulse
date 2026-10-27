import { recordConsent, ensureIdentity } from '@/features/identity/identity';
import { acquireCoarseFix, type CoarseFix } from '@/features/location/privacyBoundary';
import { isPrivate } from '@/features/location/privateZones';
import { createStore } from '@/lib/createStore';
import { supabase } from '@/lib/supabase';

/**
 * Sharing state and the single code path that sends a ping.
 *
 * What leaves the phone: `{ "cell": "<H3 id>" }` plus the anonymous session
 * token. Nothing else: no coordinates, no time (the server sets it), no
 * device identifier.
 */

/** How often the app reports while open and sharing (design: "a cell every 3 min"). */
export const PING_INTERVAL_MS = 3 * 60_000;
/** The server refuses pings closer together than this; don't bother sending them. */
const MIN_GAP_MS = 60_000;

export type SharingStatus =
  | 'off' // consent not given or withdrawn
  | 'sharing' // reporting normally
  | 'paused' // inside a private area: nothing is sent
  | 'unavailable' // OS location permission denied
  | 'offline'; // sharing on, but the server could not be reached

export interface SharingState {
  status: SharingStatus;
  /** Cell of the last accepted ping. Shown as the "me" dot. */
  myCell: string | null;
  lastSentAt: number | null;
  /** Raw pings currently stored for this identity (all expire within 20 min). */
  outstanding: number;
  /** How long the last raw position existed in memory, in ms. */
  heldMs: number | null;
}

const INITIAL: SharingState = {
  status: 'off',
  myCell: null,
  lastSentAt: null,
  outstanding: 0,
  heldMs: null,
};

export const sharingStore = createStore<SharingState>(INITIAL);
export const useSharing = () => sharingStore.use();

const patch = (p: Partial<SharingState>) => sharingStore.set((s) => ({ ...s, ...p }));

let inFlight = false;

/** Send one ping now (or with a fix the cell watcher already produced). */
export async function sendPing(fix?: CoarseFix): Promise<void> {
  if (inFlight || !supabase) {
    if (!supabase) patch({ status: 'offline' });
    return;
  }
  inFlight = true;
  try {
    const f = fix ?? (await acquireCoarseFix());
    if (isPrivate(f.privateKey)) {
      patch({ status: 'paused', myCell: null });
      return;
    }
    const last = sharingStore.get().lastSentAt;
    if (last && Date.now() - last < MIN_GAP_MS) return;

    await ensureIdentity();
    const { error } = await supabase.functions.invoke('ping', { body: { cell: f.cell } });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      // 425: identity still too new; 429: too soon. Both retry on the next tick.
      if (status === 425 || status === 429) {
        patch({ status: 'sharing' });
        return;
      }
      throw error;
    }
    patch({ status: 'sharing', myCell: f.cell, lastSentAt: Date.now(), heldMs: f.heldMs });
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
  patch({ status: 'off', myCell: null });
  await recordConsent(false);
  return deleteSentPings();
}

/** Delete every raw ping this identity has sent. Returns how many were removed. */
export async function deleteSentPings(): Promise<number> {
  if (!supabase) return 0;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return 0;
  const { data } = await supabase.rpc('delete_my_pings');
  patch({ outstanding: 0, myCell: null });
  return typeof data === 'number' ? data : 0;
}

/** Status changes driven by consent and OS permission (not by sending). */
export function setSharingStatus(status: SharingStatus) {
  patch(status === 'off' || status === 'unavailable' ? { status, myCell: null } : { status });
}

/** Back to a fresh install (Delete my data). */
export function resetSharing() {
  sharingStore.set(INITIAL);
}
