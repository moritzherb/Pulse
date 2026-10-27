/**
 * The privacy contract of a ping, tested at the only place one is sent:
 * the request body contains the H3 cell id and nothing else.
 */
// jest.mock() calls below are hoisted above this import by babel-jest.
import { resetSharing, sendPing, sharingStore, withdraw } from '@/features/sharing/sharing';

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
const mockFix = {
  cell: '881e15b713fffff',
  privateKey: '891e15b7133ffff',
  heldMs: 3,
  acquiredAt: 0,
};
jest.mock('@/features/location/privacyBoundary', () => ({
  acquireCoarseFix: jest.fn(async () => mockFix),
}));
const mockIsPrivate = jest.fn((_key: string) => false);
jest.mock('@/features/location/privateZones', () => ({
  isPrivate: (k: string) => mockIsPrivate(k),
}));

beforeEach(() => {
  mockInvoke.mockReset();
  mockRpc.mockReset();
  mockIsPrivate.mockReturnValue(false);
  resetSharing();
});

it('sends exactly { cell } and nothing else', async () => {
  mockInvoke.mockResolvedValue({ data: { accepted: true }, error: null });
  mockRpc.mockResolvedValue({ data: 1 });
  await sendPing();
  expect(mockInvoke).toHaveBeenCalledTimes(1);
  const [name, options] = mockInvoke.mock.calls[0] as [string, { body: unknown }];
  expect(name).toBe('ping');
  expect(options).toEqual({ body: { cell: '881e15b713fffff' } });
  expect(sharingStore.get()).toMatchObject({
    status: 'sharing',
    myCell: mockFix.cell,
    outstanding: 1,
  });
});

it('sends nothing from a private area', async () => {
  mockIsPrivate.mockReturnValue(true);
  await sendPing();
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(sharingStore.get()).toMatchObject({ status: 'paused', myCell: null });
});

it('does not send twice within a minute', async () => {
  mockInvoke.mockResolvedValue({ data: { accepted: true }, error: null });
  mockRpc.mockResolvedValue({ data: 1 });
  await sendPing();
  await sendPing();
  expect(mockInvoke).toHaveBeenCalledTimes(1);
});

it('treats rate limiting as a retry, not an error', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { context: { status: 429 } } });
  await sendPing();
  expect(sharingStore.get()).toMatchObject({ status: 'sharing', lastSentAt: null });
});

it('reports the server being unreachable', async () => {
  mockInvoke.mockRejectedValue(new Error('network'));
  await sendPing();
  expect(sharingStore.get().status).toBe('offline');
});

it('withdrawing deletes what was sent', async () => {
  mockRpc.mockResolvedValue({ data: 3 });
  await expect(withdraw()).resolves.toBe(3);
  expect(mockRpc).toHaveBeenCalledWith('delete_my_pings');
  expect(sharingStore.get()).toMatchObject({ status: 'off', myCell: null, outstanding: 0 });
});
