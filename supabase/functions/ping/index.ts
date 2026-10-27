/**
 * POST /functions/v1/ping   { "venue": 48213 }
 *
 * The only way a phone contributes to the map. Accepts exactly one thing: the
 * id of the public place (café, museum, park) the phone found itself in, by
 * checking its position against the place outlines on the phone. Any other
 * field in the body is ignored and never stored. The server sets the time.
 *
 * Responses
 *   200 { accepted: true, expiresAt }      stored; deleted at expiresAt
 *   400 { error: "invalid_venue" }         not a known place
 *   401 { error: "unauthorized" }          no / unknown anonymous session
 *   425 { accepted: false, reason: "too_new" }       identity too fresh
 *   429 { accepted: false, reason: "rate_limited" }  sent too recently
 *
 * Nothing about the caller or the place is logged.
 */
import { json, numberEnv } from '../_shared/http.ts';
import { adminClient, callerFrom } from '../_shared/supabase.ts';

/** Minimum gap between two accepted pings from one identity. */
const MIN_INTERVAL_S = numberEnv('PING_MIN_INTERVAL_SECONDS', 60);
/** New identities wait this long before they count (raises the cost of faking devices). */
const MIN_ACCOUNT_AGE_S = numberEnv('PING_MIN_ACCOUNT_AGE_SECONDS', 120);
/** Must match purge_expired_pings(). */
const RETENTION_MS = 20 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await callerFrom(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let venue: unknown;
  try {
    venue = ((await req.json()) as { venue?: unknown })?.venue;
  } catch {
    return json({ error: 'invalid_venue' }, 400);
  }
  if (typeof venue !== 'number' || !Number.isSafeInteger(venue) || venue <= 0) {
    return json({ error: 'invalid_venue' }, 400);
  }

  const { data, error } = await adminClient().rpc('record_ping', {
    p_user: user.id,
    p_venue: venue,
    p_min_interval: `${MIN_INTERVAL_S} seconds`,
    p_min_account_age: `${MIN_ACCOUNT_AGE_S} seconds`,
  });

  if (error) {
    console.error('record_ping failed', error.code);
    return json({ error: 'server_error' }, 500);
  }

  switch (data as string) {
    case 'ok':
      return json({ accepted: true, expiresAt: new Date(Date.now() + RETENTION_MS).toISOString() });
    case 'rate_limited':
      return json({ accepted: false, reason: 'rate_limited' }, 429);
    case 'too_new':
      return json({ accepted: false, reason: 'too_new' }, 425);
    case 'unknown_venue':
      return json({ error: 'invalid_venue' }, 400);
    default:
      return json({ error: 'unauthorized' }, 401);
  }
});
