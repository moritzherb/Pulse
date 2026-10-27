import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { heatLevels, heatmapDensityStops, useTheme } from '@/theme';
import type { LivePlace } from '@shared/types.ts';

import { usePulse } from './usePulse';

/**
 * Crowd layers. The heat sits on the places themselves: each live place adds
 * a soft blob whose strength follows its level, so a packed café glows red
 * and the street outside stays clear. From street zoom the blob keeps the
 * same size on the ground (see blobRadius), so the city view
 * shows the hot spots and the street view shows which place is busy.
 *
 * From street zoom, each place also gets a dot in its level colour and its
 * name (busy places first), and the selected place a ring. The heatmap
 * breathes slowly while anything is Busy or Packed.
 */

/** Level as heatmap weight: one place on its own maps to its level's colour on the ramp. */
const LEVEL_WEIGHT: Record<LivePlace['level'], number> = {
  quiet: 0.3,
  moderate: 0.5,
  busy: 0.78,
  packed: 1,
};

const levelColor = [
  'match',
  ['get', 'level'],
  'packed',
  heatLevels.packed.color,
  'busy',
  heatLevels.busy.color,
  'moderate',
  heatLevels.moderate.color,
  heatLevels.quiet.color,
] as const;

/**
 * Blob radius in pixels: about 90 m on the ground from street zoom on (the
 * visible glow is about half that), and never smaller than a few pixels so
 * hot spots still show at city zoom.
 */
const blobRadius = [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  10,
  6,
  12,
  9,
  14,
  16,
  16,
  56,
  18,
  225,
];

export interface HeatLayersProps {
  places: readonly LivePlace[];
  selectedId: number | null;
  onPlacePress: (id: number) => void;
}

export function HeatLayers({ places, selectedId, onPlacePress }: HeatLayersProps) {
  const { colors, motion } = useTheme();
  const anyBusy = places.some((p) => p.level === 'busy' || p.level === 'packed');
  const { on: pulseOn } = usePulse(motion.placePulsePeriod, anyBusy);
  const half = motion.placePulsePeriod / 2;

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
          'heatmap-intensity': pulseOn ? 1.12 : 1,
          'heatmap-intensity-transition': { duration: half, delay: 0 },
          'heatmap-radius': blobRadius as never,
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            ...heatmapDensityStops.flat(),
          ] as never,
        }}
      />
      <Layer
        id="place-dot"
        type="circle"
        minzoom={13}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 17, 5] as never,
          'circle-color': levelColor as never,
          'circle-color-transition': { duration: motion.levelChange, delay: 0 },
          'circle-stroke-color': colors.map.placeStroke,
          'circle-stroke-width': 1.5,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.6, 1] as never,
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.6, 1] as never,
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
