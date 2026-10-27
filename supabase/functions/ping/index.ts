/**
 * POST /functions/v1/ping   { "cell": "881e15b713fffff" }
 *
 * The only way a phone contributes to the map. Accepts exactly one thing, an
 * H3 cell id at resolution 8. Any other field in the body is ignored and
 * never stored. The server sets the time.
 *
 * Responses
 *   200 { accepted: true, expiresAt }      stored; deleted at expiresAt
 *   400 { error: "invalid_cell" }          not a resolution-8 H3 cell
 *   401 { error: "unauthorized" }          no / unknown anonymous session
 *   425 { accepted: false, reason: "too_new" }       identity too fresh
 *   429 { accepted: false, reason: "rate_limited" }  sent too recently
 *
 * Nothing about the caller or the cell is logged.
 */
import { cellToLatLng, cellToParent, getResolution, isValidCell } from 'npm:h3-js@4';

import { json, numberEnv } from '../_shared/http.ts';
import { adminClient, callerFrom } from '../_shared/supabase.ts';
import { H3_RESOLUTION, REGION_RESOLUTION } from '../_shared/types.ts';

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

  let cell: unknown;
  try {
    cell = ((await req.json()) as { cell?: unknown })?.cell;
  } catch {
    return json({ error: 'invalid_cell' }, 400);
  }
  if (typeof cell !== 'string' || !isValidCell(cell) || getResolution(cell) !== H3_RESOLUTION) {
    return json({ error: 'invalid_cell' }, 400);
  }

  const region = cellToParent(cell, REGION_RESOLUTION);
  // Centre of the public hexagon, derived from the id. Used for place names.
  const [lat, lng] = cellToLatLng(cell);

  const { data, error } = await adminClient().rpc('record_ping', {
    p_user: user.id,
    p_cell: cell,
    p_region: region,
    p_center_lng: lng,
    p_center_lat: lat,
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
    default:
      return json({ error: 'unauthorized' }, 401);
  }
});
