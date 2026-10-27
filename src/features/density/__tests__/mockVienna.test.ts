import { buildMockPlaces, mockPlaceDetail, mockShapes } from '@/features/density/mockVienna';
import { SIM_VENUES, simulatedUsualPeak } from '@/features/density/simulation';
import { buildPlaceIndex, matchPlace } from '@/features/places/placeIndex';
import { K_ANONYMITY, levelForPlace } from '@shared/levels.ts';

// Saturday 31 Oct 2026, 14:00 in Vienna (CET, UTC+1): a busy afternoon.
const SATURDAY_AFTERNOON = new Date('2026-10-31T13:00:00Z');
// Tuesday 27 Oct 2026, 04:00 in Vienna: almost nobody around.
const TUESDAY_NIGHT = new Date('2026-10-27T03:00:00Z');

describe('simulated Vienna feed', () => {
  const places = buildMockPlaces(SATURDAY_AFTERNOON);

  it('obeys the same rules as the server', () => {
    expect(places.length).toBeGreaterThan(25);
    for (const p of places) {
      const v = SIM_VENUES.find((x) => x.id === p.id)!;
      expect(p.devices).toBeGreaterThanOrEqual(K_ANONYMITY);
      expect(p.devices % 5).toBe(0);
      expect(p.level).toBe(levelForPlace(p.devices, simulatedUsualPeak(v)));
    }
  });

  it('has every level on a busy afternoon, busiest first', () => {
    expect(new Set(places.map((p) => p.level))).toEqual(
      new Set(['quiet', 'moderate', 'busy', 'packed']),
    );
    const counts = places.map((p) => p.devices);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('follows the clock: the city is quiet before dawn', () => {
    expect(buildMockPlaces(TUESDAY_NIGHT).length).toBeLessThan(places.length / 3);
  });

  it('is deterministic', () => {
    expect(buildMockPlaces(SATURDAY_AFTERNOON)).toEqual(places);
  });

  it('builds a detail payload with a full week of history and nearby places', () => {
    const top = places[0]!;
    const detail = mockPlaceDetail(top.id, SATURDAY_AFTERNOON)!;
    expect(detail.live?.devices).toBe(top.devices);
    expect(detail.usual.hours).toHaveLength(7 * 24);
    expect(detail.place.name).toBe(top.name);
    expect(detail.nearby.every((n) => n.id !== top.id)).toBe(true);
  });

  it('can be matched on the phone without a backend', () => {
    const index = buildPlaceIndex(mockShapes());
    expect(matchPlace(index, [16.3655, 48.2104])?.name).toBe('Café Central');
  });
});
