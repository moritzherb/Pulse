import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { heatmapDensityStops, useTheme } from '@/theme';
import type { LivePlace } from '@shared/types.ts';

import { usePulse } from './usePulse';

/**
 * Crowd layers: the design's soft heatmap, restricted to places. Each live
 * place adds a small glow whose strength follows its level; places close
 * together blend, like any heatmap, and everything else stays clear. The
 * glow keeps the same small size on the ground when zooming in (see
 * blobRadius), so it never spreads over a whole district.
 *
 * Names appear from street zoom (busy places first) and the selected place
 * gets a ring. The glows breathe: they slowly swell a little and settle
 * again. JS only flips between the two states; MapLibre eases between them
 * natively (paint transitions), so the motion stays smooth on the device.
 */

/** Level as heatmap weight: one place on its own maps to its level's colour on the ramp. */
const LEVEL_WEIGHT: Record<LivePlace['level'], number> = {
  quiet: 0.3,
  moderate: 0.5,
  busy: 0.78,
  packed: 1,
};

/**
 * Glow radius in pixels: about 170 m on the ground (the visible glow is about
 * half that), doubling with each zoom level, and never under 11 px so hot
 * spots still show at city zoom. `scale` lets the glow breathe.
 */
const RADIUS_STOPS = [
  [10, 8],
  [12, 11],
  [13, 14],
  [14, 27],
  [16, 106],
  [18, 425],
] as const;

const blobRadius = (scale: number) => [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  ...RADIUS_STOPS.flatMap(([zoom, px]) => [zoom, Math.round(px * scale * 10) / 10]),
];

/** How much a glow grows at the top of a breath: a little, never a jump. */
const SWELL = { radius: 1.14, intensity: 1.1 };

export interface HeatLayersProps {
  places: readonly LivePlace[];
  selectedId: number | null;
  onPlacePress: (id: number) => void;
}

export function HeatLayers({ places, selectedId, onPlacePress }: HeatLayersProps) {
  const { colors, motion } = useTheme();
  // Stops in the background and under Reduce Motion (see usePulse).
  const { on: swell } = usePulse(motion.placePulsePeriod, places.length > 0);
  const half = motion.placePulsePeriod / 2;
  const radius = useMemo(() => blobRadius(swell ? SWELL.radius : 1), [swell]);

  const points = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: places.map((p) => ({
        type: 'Feature',
        id: p.id,
        properties: {
          id: p.id,
          name: p.name,
          level: p.level,
          weight: LEVEL_WEIGHT[p.level],
          // Busier places win label collisions.
          rank: { quiet: 1, moderate: 2, busy: 3, packed: 4 }[p.level],
        },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    }),
    [places],
  );

  return (
    <GeoJSONSource
      id="places"
      data={points}
      hitbox={{ top: 14, right: 14, bottom: 14, left: 14 }}
      onPress={(e) => {
        const id = e.nativeEvent.features[0]?.properties?.id;
        if (typeof id === 'number') onPlacePress(id);
      }}
    >
      <Layer
        id="place-heat"
        type="heatmap"
        paint={{
          'heatmap-weight': ['get', 'weight'] as never,
          'heatmap-intensity': swell ? SWELL.intensity : 1,
          'heatmap-intensity-transition': { duration: half, delay: 0 },
          'heatmap-radius': radius as never,
          'heatmap-radius-transition': { duration: half, delay: 0 },
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            ...heatmapDensityStops.flat(),
          ] as never,
        }}
      />
      {/* Invisible tap target: heatmap layers cannot be tapped. */}
      <Layer
        id="place-hit"
        type="circle"
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 8, 16, 18] as never,
          'circle-color': colors.text.primary,
          'circle-opacity': 0.01,
        }}
      />
      <Layer
        id="place-selected"
        type="circle"
        filter={['==', ['get', 'id'], selectedId ?? -1]}
        paint={{
          'circle-radius': 11,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': colors.text.primary,
          'circle-stroke-width': 2,
        }}
      />
      <Layer
        id="place-label"
        type="symbol"
        minzoom={14}
        filter={['any', ['>=', ['zoom'], 15.5], ['>=', ['get', 'rank'], 3]] as never}
        layout={{
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11.5,
          'text-anchor': 'left',
          'text-offset': [0.8, 0],
          'text-max-width': 9,
          'text-optional': true,
          'symbol-sort-key': ['-', 0, ['get', 'rank']] as never,
        }}
        paint={{
          'text-color': colors.text.body,
          'text-halo-color': colors.surface.base,
          'text-halo-width': 1.4,
        }}
      />
    </GeoJSONSource>
  );
}

/** The place the phone is at (its public position), only while sharing. */
export function MeDot({ at }: { at: [number, number] | null }) {
  const { colors } = useTheme();
  const me = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: at
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: at } }]
        : [],
    }),
    [at],
  );
  return (
    <GeoJSONSource id="me" data={me}>
      <Layer
        id="me-dot"
        type="circle"
        paint={{
          'circle-radius': 5,
          'circle-color': colors.map.meDot,
          'circle-stroke-color': colors.map.meStroke,
          'circle-stroke-width': 2,
        }}
      />
    </GeoJSONSource>
  );
}
