/**
 * Outlines for a region nobody needed before: the phone asks the server to
 * import it and reports 'pending' instead of an empty map of places.
 */
import { loadPlaceIndex } from '@/features/places/placeShapes';

const mockRpc = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
  },
  isBackendConfigured: true,
}));
jest.mock('@/lib/storage', () => ({
  StorageKeys: { placeShapes: 'k' },
  readJson: () => null,
  writeJson: jest.fn(),
}));
jest.mock('@/features/density/mockVienna', () => ({ mockShapes: jest.fn() }));

const empty = { circles: [], polygons: [] };

it('asks for an import and reports pending for a new region', async () => {
  mockRpc.mockResolvedValueOnce({
    data: { region: 'r1', importedAt: null, ...empty },
    error: null,
  });
  mockInvoke.mockResolvedValueOnce({ data: { status: 'importing' }, error: null });
  await expect(loadPlaceIndex('r1')).resolves.toBe('pending');
  expect(mockInvoke).toHaveBeenCalledWith('import-region', { body: { region: 'r1' } });
  // Asked again within a minute: no new request.
  await expect(loadPlaceIndex('r1')).resolves.toBe('pending');
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('builds the index once the region is imported', async () => {
  mockRpc.mockResolvedValueOnce({
    data: {
      region: 'r2',
      importedAt: new Date().toISOString(),
      circles: [[1, 16.3655, 48.2104, 12, 'Café Central']],
      polygons: [],
    },
    error: null,
  });
  const index = await loadPlaceIndex('r2');
  expect(index).not.toBe('pending');
  expect(index && index !== 'pending' && index.places.map((p) => p.name)).toEqual(['Café Central']);
});
