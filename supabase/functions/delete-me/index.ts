/**
 * POST /functions/v1/delete-me
 *
 * "Delete my data now". Deletes the caller's anonymous identity. Every row
 * tied to it (pings, consent records) references auth.users with ON DELETE
 * CASCADE, so they go in the same statement. Aggregates already published
 * (k-anonymous counts) contain nothing linkable and are not affected.
 *
 * 200 { deleted: true, pings: <number of raw pings removed> }
 */
import { json } from '../_shared/http.ts';
import { adminClient, callerFrom } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await callerFrom(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const admin = adminClient();
  const { count } = await admin
    .from('pings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('deleteUser failed', error.status);
    return json({ error: 'server_error' }, 500);
  }
  return json({ deleted: true, pings: count ?? 0 });
});
