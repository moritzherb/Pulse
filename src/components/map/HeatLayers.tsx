import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { cellCenter, cellsToPoints, cellsToPolygons } from '@/lib/h3';
import { heatLevels, heatmapDensityStops, useTheme } from '@/theme';
import type { LiveCell } from '@shared/types.ts';

import { usePulse } from './usePulse';

/**
 * Crowd layers.
 *
 * - City zoom (< 13): the design's soft heatmap, built from cell centres.
 * - Street zoom (>= 13): H3 hexagons in the level colour, a pattern per
 *   level (so colour is never the only cue), a white hairline, and a slow
 *   breathing glow on Busy and Packed cells.
 * The two cross-fade between zoom 12.4 and 13.4.
 */

const FADE_FROM = 12.4;
const FADE_TO = 13.4;

const patternImages = {
  'pulse-dots': require('../../../assets/map/pattern-dots.png'),
  'pulse-lines': require('../../../assets/map/pattern-lines.png'),
  'pulse-cross': require('../../../assets/map/pattern-cross.png'),
};

/** Level colour as a data-driven expression. */
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

/** Fade a value in as the camera crosses into street zoom. */
const streetOnly = (value: unknown) => [
  'interpolate',
  ['linear'],
  ['zoom'],
  FADE_FROM,
  0,
  FADE_TO,
  value,
];

export interface HeatLayersProps {
  cells: readonly LiveCell[];
  selectedCell: string | null;
  /** The phone's own coarse cell, drawn as a dot. Null when not sharing. */
  myCell: string | null;
  onCellPress: (cell: string) => void;
}

export function HeatLayers({ cells, selectedCell, myCell, onCellPress }: HeatLayersProps) {
  const { colors, motion } = useTheme();
  const { on: pulseOn } = usePulse(motion.cellPulsePeriod);
  const half = motion.cellPulsePeriod / 2;

  const polygons = useMemo(() => cellsToPolygons(cells), [cells]);
  const points = useMemo(() => cellsToPoints(cells), [cells]);
  const me = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: myCell
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: cellCenter(myCell) },
            },
          ]
        : [],
    }),
    [myCell],
  );

  return (
    <>
      <Images images={patternImages} />

      <GeoJSONSource id="heat-points" data={points}>
        <Layer
          id="heat-blur"
          type="heatmap"
          paint={{
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'devices'], 0, 0.15, 50, 1],
            // Breathes with the pulse so the city view feels alive too.
            'heatmap-intensity': pulseOn ? 1.22 : 1.1,
            'heatmap-intensity-transition': { duration: half, delay: 0 },
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 22, 12, 44, 15, 90],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], FADE_FROM, 0.78, FADE_TO, 0],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              ...heatmapDensityStops.flat(),
            ] as never,
          }}
        />
      </GeoJSONSource>

      <GeoJSONSource
        id="heat-cells"
        data={polygons}
        onPress={(e) => {
          const cell = e.nativeEvent.features[0]?.properties?.cell;
          if (typeof cell === 'string') onCellPress(cell);
        }}
      >
        <Layer
          id="hex-fill"
          type="fill"
          paint={{ 'fill-color': levelColor as never, 'fill-opacity': streetOnly(0.55) as never }}
        />
        <Layer
          id="hex-pattern"
          type="fill"
          filter={['!=', ['get', 'level'], 'quiet']}
          paint={{
            'fill-pattern': [
              'match',
              ['get', 'level'],
              'packed',
              'pulse-cross',
              'busy',
              'pulse-lines',
              'pulse-dots',
            ] as never,
            'fill-opacity': streetOnly(0.9) as never,
          }}
        />
        <Layer
          id="hex-pulse"
          type="fill"
          filter={['in', ['get', 'level'], ['literal', ['busy', 'packed']]]}
          paint={{
            'fill-color': levelColor as never,
            'fill-opacity': streetOnly([
              'match',
              ['get', 'level'],
              'packed',
              pulseOn ? 0.34 : 0,
              pulseOn ? 0.2 : 0,
            ]) as never,
            'fill-opacity-transition': { duration: half, delay: 0 },
          }}
        />
        <Layer
          id="hex-line"
          type="line"
          paint={{
            'line-color': colors.map.hexStroke,
            'line-width': 1,
            'line-opacity': streetOnly(0.8) as never,
          }}
        />
        <Layer
          id="hex-selected"
          type="line"
          filter={['==', ['get', 'cell'], selectedCell ?? '']}
          paint={{ 'line-color': colors.text.primary, 'line-width': 2 }}
        />
      </GeoJSONSource>

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
    </>
  );
}
