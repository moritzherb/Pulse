import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';

import type { ColorScheme } from '@/theme';

/**
 * Basemap. OpenFreeMap's Positron is the vector version of the CARTO
 * "light_all" raster the design prototype uses: same cartography, free, no
 * key, OpenStreetMap data.
 *
 * Dark mode is a fill-in. OpenFreeMap has no matching dark Positron, so the
 * light style is fetched once and its colours are remapped: lightness is
 * inverted into a narrow dark band, saturation is reduced, and labels are
 * kept readable. Same roads, same labels, same hierarchy.
 */
export const POSITRON_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Background colour per scheme, matching the map tokens. */
const DARK_BACKGROUND = '#111113';

let darkStyleCache: StyleSpecification | null = null;
let darkStylePending: Promise<StyleSpecification | null> | null = null;

/** The style to pass to <Map mapStyle>. Light is a URL; dark is built on demand. */
export function useMapStyle(scheme: ColorScheme): string | StyleSpecification {
  const [dark, setDark] = useState<StyleSpecification | null>(darkStyleCache);

  useEffect(() => {
    if (scheme !== 'dark' || darkStyleCache) return;
    let cancelled = false;
    loadDarkStyle().then((s) => {
      if (!cancelled && s) setDark(s);
    });
    return () => {
      cancelled = true;
    };
  }, [scheme]);

  if (scheme === 'light') return POSITRON_URL;
  // While the dark style is being built (or if the network fails), show a
  // plain dark background rather than a flash of the light map.
  return dark ?? darkStyleCache ?? placeholderStyle(DARK_BACKGROUND);
}

function loadDarkStyle(): Promise<StyleSpecification | null> {
  if (!darkStylePending) {
    darkStylePending = fetch(POSITRON_URL)
      .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : null))
      .then((light) => {
        if (!light) return null;
        darkStyleCache = toDark(light);
        return darkStyleCache;
      })
      .catch(() => {
        darkStylePending = null; // allow a retry on next mount
        return null;
      });
  }
  return darkStylePending;
}

function placeholderStyle(background: string): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': background } }],
  };
}

// ------------------------------------------------------------ recolouring ---

/** Return a dark copy of a light style. Exported for unit tests. */
export function toDark(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.map((layer) => {
    if (!('paint' in layer) || !layer.paint) return layer;
    const paint: Record<string, unknown> = { ...(layer.paint as Record<string, unknown>) };
    for (const key of Object.keys(paint)) {
      if (!key.endsWith('-color')) continue;
      const role: Role =
        key === 'text-color'
          ? 'text'
          : key === 'text-halo-color' || key === 'icon-halo-color'
            ? 'halo'
            : 'fill';
      paint[key] = mapColors(paint[key], role);
    }
    if (layer.type === 'background') paint['background-color'] = DARK_BACKGROUND;
    return { ...layer, paint } as typeof layer;
  });
  return { ...style, layers };
}

type Role = 'fill' | 'text' | 'halo';

/** Walk a paint value (plain colour or expression) and remap every colour string in it. */
function mapColors(value: unknown, role: Role): unknown {
  if (typeof value === 'string') {
    const hsla = parseColor(value);
    return hsla ? formatHsla(darken(hsla, role)) : value;
  }
  if (Array.isArray(value)) return value.map((v) => mapColors(v, role));
  if (value && typeof value === 'object') {
    // Legacy stop functions: { stops: [[zoom, colour], ...] }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapColors(v, role);
    return out;
  }
  return value;
}

type Hsla = [h: number, s: number, l: number, a: number];

function darken([h, s, l, a]: Hsla, role: Role): Hsla {
  switch (role) {
    case 'text':
      // Light-grey labels on a dark ground: invert, keep within a readable band.
      return [h, s * 0.5, clamp(1.02 - l, 0.5, 0.82), a];
    case 'halo':
      return [h, s * 0.4, 0.07, a];
    default:
      // Fills and lines: invert into 7%..27% lightness so the map stays quiet.
      return [h, s * 0.55, 0.07 + (1 - l) * 0.2, a];
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function formatHsla([h, s, l, a]: Hsla): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  return `hsla(${r(h)}, ${r(s * 100)}%, ${r(l * 100)}%, ${Math.round(a * 1000) / 1000})`;
}

/** Parse #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla(). Anything else: null. */
export function parseColor(input: string): Hsla | null {
  const s = input.trim().toLowerCase();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const full =
      hex.length === 3 || hex.length === 4
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(full)) return null;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
    return rgbToHsl(n(0), n(2), n(4), full.length === 8 ? n(6) : 1);
  }
  const m = /^(rgba?|hsla?)\(([^)]+)\)$/.exec(s);
  if (!m) return null;
  const parts = m[2]!.split(/[\s,/]+/).filter(Boolean);
  const num = (p: string | undefined, pctScale: number) =>
    p === undefined ? NaN : p.endsWith('%') ? (parseFloat(p) / 100) * pctScale : parseFloat(p);
  const alpha = parts[3] === undefined ? 1 : num(parts[3], 1);
  if (m[1]!.startsWith('rgb')) {
    const [r, g, b] = [0, 1, 2].map((i) => num(parts[i], 255) / 255) as [number, number, number];
    return [r, g, b, alpha].some(Number.isNaN) ? null : rgbToHsl(r, g, b, alpha);
  }
  const h = parseFloat(parts[0] ?? '');
  const sat = num(parts[1], 1);
  const light = num(parts[2], 1);
  return [h, sat, light, alpha].some(Number.isNaN) ? null : [h, sat, light, alpha];
}

function rgbToHsl(r: number, g: number, b: number, a: number): Hsla {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l, a];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l, a];
}
