import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

import { env } from './http.ts';

const url = () => env('SUPABASE_URL');

/** Service-role client. Bypasses RLS: use only for the narrow calls each function needs. */
export function adminClient(): SupabaseClient {
  return createClient(url(), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve the caller from their access token. The gateway has already
 * verified the JWT (verify_jwt = true); this also confirms the user still
 * exists, so a deleted identity cannot keep sending.
 */
export async function callerFrom(req: Request): Promise<User | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : data.user;
}
