/**
 * The privacy contract of a ping, tested at the only place one is sent:
 * the request body contains the place id and nothing else, and nothing is
 * sent when the phone is not at a place.
 */
// jest.mock() calls below are hoisted above this import by babel-jest.
import {
  DWELL_MS,
  resetSharing,
  sendPing,
  sharingStore,
  withdraw,
} from '@/features/sharing/sharing';

const mockInvoke = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
  },
  isBackendConfigured: true,
}));
jest.mock('@/features/identity/identity', () => ({
  ensureIdentity: jest.fn(async () => 'u1'),
  recordConsent: jest.fn(async () => {}),
}));

const cafe = { id: 4711, name: 'Café Central', center: [16.3655, 48.2104] as [number, number] };
const mockFix = {
  region: '851e15b7fffffff',
  privateKey: '891e15b7133ffff',
  place: cafe as typeof cafe | null,
  precise: true,
  indexReady: true,
  heldMs: 3,
  acquiredAt: 0,
};
jest.mock('@/features/location/privacyBoundary', () => ({
  acquirePlaceFix: jest.fn(async () => mockFix),
}));
const mockLoad = jest.fn(
  async (_region: string): Promise<{ region: string; places: never[] } | 'pending'> => ({
    region: 'r',
    places: [],
  }),
);
jest.mock('@/features/places/placeShapes', () => ({
  cachedPlaceIndex: () => null,
  loadPlaceIndex: (r: string) => mockLoad(r),
}));
const mockIsPrivate = jest.fn((_key: string) => false);
jest.mock('@/features/location/privateZones', () => ({
  isPrivate: (k: string) => mockIsPrivate(k),
}));

/** Arrive at the café and stay long enough to count. */
async function arriveAndStay() {
  await sendPing();
  await jest.advanceTimersByTimeAsync(DWELL_MS + 1_000);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockInvoke.mockReset();
  mockRpc.mockReset();
  mockLoad.mockClear();
  mockIsPrivate.mockReturnValue(false);
  Object.assign(mockFix, { place: cafe, precise: true, indexReady: true });
  resetSharing();
});
afterEach(() => jest.useRealTimers());

it('sends exactly { venue } and nothing else, after staying two minutes', async () => {
  mockInvoke.mockResolvedValue({ data: { accepted: true }, error: null });
  mockRpc.mockResolvedValue({ data: 1 });
  await sendPing();
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(sharingStore.get()).toMatchObject({ status: 'arriving', myPlace: cafe });

  await jest.advanceTimersByTimeAsync(DWELL_MS + 1_000);
  expect(mockInvoke).toHaveBeenCalledTimes(1);
  const [name, options] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
  expect(name).toBe('ping');
  expect(options).toEqual({ body: { venue: 4711 } });
  expect(sharingStore.get()).toMatchObject({ status: 'sharing', myPlace: cafe, outstanding: 1 });
});

it('sends nothing when not at a place', async () => {
  mockFix.place = null;
  await sendPing();
  await jest.advanceTimersByTimeAsync(DWELL_MS * 2);
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(sharingStore.get()).toMatchObject({ status: 'away', myPlace: null });
});

it('sends nothing when the position is too rough to name a place', async () => {
  mockFix.precise = false;
  await sendPing();
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(sharingStore.get().status).toBe('imprecise');
});

it('sends nothing from a private area', async () => {
  mockIsPrivate.mockReturnValue(true);
  await arriveAndStay();
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(sharingStore.get()).toMatchObject({ status: 'paused', myPlace: null });
});

it('downloads the region outlines first when they are missing', async () => {
  mockFix.indexReady = false;
  await sendPing();
  expect(mockLoad).toHaveBeenCalledWith('851e15b7fffffff');
});

it('sends nothing while the region’s places are still being imported', async () => {
  mockFix.indexReady = false;
  mockLoad.mockResolvedValueOnce('pending');
  await sendPing();
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(sharingStore.get()).toMatchObject({ status: 'preparing', myPlace: null });
});

it('does not send twice within a minute', async () => {
  mockInvoke.mockResolvedValue({ data: { accepted: true }, error: null });
  mockRpc.mockResolvedValue({ data: 1 });
  await arriveAndStay();
  await sendPing();
  expect(mockInvoke).toHaveBeenCalledTimes(1);
});

it('treats rate limiting as a retry, not an error', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { context: { status: 429 } } });
  await arriveAndStay();
  expect(sharingStore.get()).toMatchObject({ status: 'sharing', lastSentAt: null });
});

it('reports the server being unreachable', async () => {
  mockInvoke.mockRejectedValue(new Error('network'));
  await arriveAndStay();
  expect(sharingStore.get().status).toBe('offline');
});

it('withdrawing deletes what was sent', async () => {
  mockRpc.mockResolvedValue({ data: 3 });
  await expect(withdraw()).resolves.toBe(3);
  expect(mockRpc).toHaveBeenCalledWith('delete_my_pings');
  expect(sharingStore.get()).toMatchObject({ status: 'off', myPlace: null, outstanding: 0 });
});
