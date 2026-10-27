import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { VENUE_MIN_ZOOM, type VenuePin } from '@/features/venues/useVenues';
import { useTheme } from '@/theme';

/**
 * Venue pins at street zoom. fill-in: the design has no pins. They reuse its
 * ring vocabulary (the search and settings icons are hollow rings), which
 * keeps them clearly apart from the solid "me" dot. Names appear from zoom
 * 15.5, with MapLibre's collision handling keeping labels readable.
 */
export function VenueLayer({
  pins,
  onPress,
}: {
  pins: readonly VenuePin[];
  onPress: (pin: VenuePin) => void;
}) {
  const { colors } = useTheme();
  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: pins.map((p) => ({
        type: 'Feature',
        id: p.id,
        properties: { id: p.id, name: p.name },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    }),
    [pins],
  );
  const fadeIn = (to: number) => [
    'interpolate',
    ['linear'],
    ['zoom'],
    VENUE_MIN_ZOOM,
    0,
    VENUE_MIN_ZOOM + 0.5,
    to,
  ];

  return (
    <GeoJSONSource
      id="venues"
      data={data}
      hitbox={{ top: 12, right: 12, bottom: 12, left: 12 }}
      onPress={(e) => {
        const id = e.nativeEvent.features[0]?.properties?.id;
        const pin = pins.find((p) => p.id === id);
        if (pin) onPress(pin);
      }}
    >
      <Layer
        id="venue-ring"
        type="circle"
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], VENUE_MIN_ZOOM, 3, 17, 5] as never,
          'circle-color': colors.surface.base,
          'circle-stroke-color': colors.text.primary,
          'circle-stroke-width': 1.5,
          'circle-opacity': fadeIn(1) as never,
          'circle-stroke-opacity': fadeIn(1) as never,
        }}
      />
      <Layer
        id="venue-label"
        type="symbol"
        minzoom={15.5}
        layout={{
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 0.9],
          'text-anchor': 'top',
          'text-max-width': 8,
          'text-optional': true,
        }}
        paint={{
          'text-color': colors.text.secondary,
          'text-halo-color': colors.surface.base,
          'text-halo-width': 1.2,
        }}
      />
    </GeoJSONSource>
  );
}
