import type { LivePlace } from '@shared/types.ts';

import type { PlaceDetail } from '@/features/detail/types';
import type { ShapesPayload } from '@/features/places/placeIndex';

import { SIM_VENUES, simRegion, simulatedLivePlace, simulatedUsual } from './simulation';

/**
 * The simulated feed for development builds: the same Vienna crowd model the
 * seed script writes into the database, evaluated on the phone. The server's
 * rules are applied (k >= 5, rounded to 5, levels against the usual peak), so
 * it looks exactly like live data.
 */

export function buildMockPlaces(now = new Date()): LivePlace[] {
  return SIM_VENUES.map((v) => simulatedLivePlace(v, now))
    .filter((p): p is LivePlace => p !== null)
    .sort((a, b) => b.devices - a.devices);
}

/** Detail sheet payload for a simulated place (see get_venue_detail()). */
export function mockPlaceDetail(id: number, now = new Date()): PlaceDetail | null {
  const v = SIM_VENUES.find((x) => x.id === id);
  if (!v) return null;
  const live = simulatedLivePlace(v, now);
  const nearby = buildMockPlaces(now)
    .filter((p) => p.id !== id && Math.hypot((p.lat - v.lat) * 111, (p.lng - v.lng) * 74) < 0.4)
    .sort((a, b) => b.devices - a.devices)
    .slice(0, 6)
    .map(({ id: nid, name, category, devices, level }) => ({
      id: nid,
      name,
      category,
      devices,
      level,
    }));
  return {
    place: {
      id,
      name: v.name,
      category: v.category,
      kind: v.kind,
      lng: v.lng,
      lat: v.lat,
      area: null,
      tz: 'Europe/Vienna',
    },
    live: live
      ? { devices: live.devices, level: live.level, trend: live.trend, updatedAt: live.updatedAt }
      : null,
    usual: { weeks: 4, hours: simulatedUsual(v) },
    nearby,
  };
}

/** Simulated places as pins, so quiet places can be tapped without a backend. */
export function mockVenues() {
  return SIM_VENUES.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category,
    kind: v.kind,
    lng: v.lng,
    lat: v.lat,
  }));
}

/** Outlines for matching on the phone without a backend: each place as a circle. */
export function mockShapes(): ShapesPayload {
  return {
    region: SIM_VENUES[0] ? simRegion(SIM_VENUES[0]) : '',
    circles: SIM_VENUES.map((v) => [v.id, v.lng, v.lat, v.radiusM, v.name]),
    polygons: [],
  };
}
