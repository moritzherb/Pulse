import type { Category, HeatLevel, LivePlace } from '@shared/types.ts';

/** Typical devices for one local weekday (ISO 1 = Monday) and hour (0-23). */
export interface UsualPoint {
  d: number;
  h: number;
  v: number;
}

/** Another live place nearby, for the detail sheet. */
export interface NearbyPlace {
  id: number;
  name: string;
  category: Category;
  devices: number;
  level: HeatLevel;
}

/** What the detail sheet shows for a place. Mirrors get_venue_detail(). */
export interface PlaceDetail {
  place: {
    id: number;
    name: string;
    category: Category;
    kind: string | null;
    lng: number;
    lat: number;
    /** Name of the neighbourhood or square it is in, if known. */
    area: string | null;
    /** The place's IANA time zone; "usually" hours are local to it. */
    tz?: string | null;
  };
  /** Current k-anonymous state, or null under 5 devices. */
  live: Pick<LivePlace, 'devices' | 'level' | 'trend' | 'updatedAt'> | null;
  /** History. `hours` is empty until there are at least 3 weeks of it. */
  usual: { weeks: number; hours: UsualPoint[] };
  nearby: NearbyPlace[];
}

/** The place that was tapped (on the map, in the list or as a pin). */
export interface Selection {
  id: number;
  name: string;
  category: Category;
  kind: string | null;
  lng: number;
  lat: number;
}
