import type { Category, LiveCell } from '@shared/types.ts';

/** Typical devices for one local weekday (ISO 1 = Monday) and hour (0-23). */
export interface UsualPoint {
  d: number;
  h: number;
  v: number;
}

export interface VenueRef {
  id: number;
  name: string;
  category: Category;
  kind: string | null;
}

/** What the detail sheet shows for a cell. Mirrors get_cell_detail(). */
export interface CellDetail {
  cell: string;
  /** Nearest place name, available even when the cell is not live. */
  label: string | null;
  /** Current k-anonymous state, or null under 5 devices. */
  live: LiveCell | null;
  /** History. `hours` is empty until there are at least 3 weeks of it. */
  usual: { weeks: number; hours: UsualPoint[] };
  venues: VenueRef[];
}

/** What was tapped: a cell (hexagon / list row) or a venue pin. */
export interface Selection {
  cell: string;
  venue?: { name: string; category: Category; kind: string | null };
}
