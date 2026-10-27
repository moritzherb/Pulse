import { POLICY_VERSION } from '@/features/consent/consent';
import { createStore } from '@/lib/createStore';
import { supabase } from '@/lib/supabase';

/**
 * The rotating anonymous identity.
 *
 * A Supabase anonymous user: no email, no name, no device identifier. It is
 * created the first time the phone shares, replaced after 24 hours or on
 * "Rotate my ID now", and deleted with everything linked to it on "Delete my
 * data now". Abandoned identities are deleted by the server after 25 hours.
 * Browsing the map never creates one.
 */

export const ROTATE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface Identity {
  userId: string | null;
  createdAt: string | null;
}

export const identityStore = createStore<Identity>({ userId: null, createdAt: null });
export const useIdentity = () => identityStore.use();

// Pick up a session persisted from an earlier launch.
supabase?.auth.getSession().then(({ data }) => {
  const user = data.session?.user;
  if (user) identityStore.set({ userId: user.id, createdAt: user.created_at });
});

function isFresh(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < ROTATE_AFTER_MS;
}

async function signInFresh(): Promise<string> {
  if (!supabase) throw new Error('backend_not_configured');
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error('anonymous_sign_in_failed');
  identityStore.set({ userId: data.user.id, createdAt: data.user.created_at });
  // Every new identity carries its own proof of consent (GDPR Art. 7(1)).
  await recordConsent(true);
  return data.user.id;
}

/**
 * The identity to send under. Reuses the current one while it is younger
 * than 24 hours; otherwise starts a new one. Only called while sharing is on.
 */
export async function ensureIdentity(): Promise<string> {
  if (!supabase) throw new Error('backend_not_configured');
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user && isFresh(user.created_at)) return user.id;
  if (user) await supabase.auth.signOut({ scope: 'local' });
  return signInFresh();
}

/** "Rotate my ID now". Nothing sent before is linked to the new ID. */
export async function rotateIdentity(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: 'local' });
  identityStore.set({ userId: null, createdAt: null });
  await signInFresh();
}

/**
 * "Delete my data now": deletes the identity on the server (cascading to
 * pings and consent records), then forgets the session locally.
 * Returns the number of raw pings that were deleted.
 */
export async function deleteIdentity(): Promise<number> {
  let removed = 0;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const res = await supabase.functions.invoke<{ pings: number }>('delete-me', {
        method: 'POST',
      });
      if (res.error) throw res.error;
      removed = res.data?.pings ?? 0;
    }
    await supabase.auth.signOut({ scope: 'local' });
  }
  identityStore.set({ userId: null, createdAt: null });
  return removed;
}

/** Append a consent decision for the current identity, if there is one. */
export async function recordConsent(granted: boolean): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await supabase
    .from('consent_records')
    .insert({ purpose: 'location', granted, policy_version: POLICY_VERSION });
}
