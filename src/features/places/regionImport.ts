import { supabase } from '@/lib/supabase';

/**
 * Ask the server to make sure the public places of a region (H3 resolution
 * 5, ~250 km²) are imported from OpenStreetMap, so Pulse works anywhere.
 * The request names only the region. See supabase/functions/import-region.
 */

export type ImportState = 'ready' | 'importing' | 'limited' | 'failed';

/** Ask again about a region that is still importing at most this often. */
const RETRY_MS = 60_000;

const ready = new Set<string>();
const askedAt = new Map<string, number>();

export async function requestRegionImport(region: string): Promise<ImportState> {
  if (ready.has(region)) return 'ready';
  const client = supabase;
  if (!client) return 'failed';
  const last = askedAt.get(region);
  if (last !== undefined && Date.now() - last < RETRY_MS) return 'importing';
  askedAt.set(region, Date.now());

  const { data, error } = await client.functions.invoke('import-region', { body: { region } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    return status === 429 ? 'limited' : 'failed';
  }
  if ((data as { status?: string } | null)?.status === 'ready') {
    ready.add(region);
    return 'ready';
  }
  return 'importing';
}

/** The region was seen as imported elsewhere (venue_shapes): no need to ask. */
export function markRegionReady(region: string) {
  ready.add(region);
}
