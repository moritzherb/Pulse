// jest.mock() is hoisted above the imports by babel-jest.
import { buildMockPlaces } from '@/features/density/mockVienna';
import { summarise } from '@/features/density/useOverview';

jest.mock('@/lib/supabase', () => ({ supabase: null, isBackendConfigured: false }));

// Saturday 31 Oct 2026, 14:00 in Vienna: a busy afternoon.
const places = buildMockPlaces(new Date('2026-10-31T13:00:00Z'));

describe('world overview', () => {
  it('sums a region into one area named after its city', () => {
    const [area] = summarise(places);
    expect(area).toMatchObject({ name: 'Vienna', level: 'packed' });
    expect(area!.id).toBeLessThan(0);
    expect(area!.devices).toBe(places.reduce((s, p) => s + p.devices, 0));
    expect(area!.kind).toBe(`${places.length} places`);
  });

  it('is empty when nothing is live', () => {
    expect(summarise([])).toEqual([]);
  });
});
