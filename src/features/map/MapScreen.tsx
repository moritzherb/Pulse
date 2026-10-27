import {
  Camera,
  Map,
  type CameraRef,
  type MapRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, useWindowDimensions, View, type NativeSyntheticEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DETAIL_SNAP, PlaceDetailSheet } from '@/components/detail/PlaceDetailSheet';
import { BusiestSheet } from '@/components/map/BusiestSheet';
import { EmptyState } from '@/components/map/EmptyState';
import { HeatLayers, MeDot } from '@/components/map/HeatLayers';
import { MapControls } from '@/components/map/MapControls';
import { MapTopBar } from '@/components/map/MapTopBar';
import { VenueLayer } from '@/components/map/VenueLayer';
import { Toast } from '@/components/ui';
import { DEFAULT_CITY, nearestCity, searchCities, type City } from '@/data/cities';
import { useConsent } from '@/features/consent/consent';
import { useDensity } from '@/features/density/useDensity';
import type { Selection } from '@/features/detail/types';
import { useSharing } from '@/features/sharing/sharing';
import { useVenues, type VenuePin } from '@/features/venues/useVenues';
import {
  acquireCoarseFix,
  permissionState,
  requestPermission,
  type PermissionState,
} from '@/features/location/privacyBoundary';
import { cellCenter, type LngLat } from '@/lib/h3';
import { ago, useNow } from '@/lib/time';
import { useTheme } from '@/theme';
import type { Category, LivePlace } from '@shared/types.ts';

import { useMapStyle } from './mapStyle';

const CITY_ZOOM = 12.2;
const LOCATE_ZOOM = 12.6;
const PLACE_ZOOM = 15.6;

type Bounds = [west: number, south: number, east: number, north: number];

/**
 * The main screen: the place heatmap, place pins, search, filters, controls,
 * the "Busiest now" card and the place detail sheet.
 */
export function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  // Under Reduce Motion the camera jumps instead of flying.
  const reduceMotion = useReducedMotion();
  const consent = useConsent();
  const [center, setCenter] = useState({ lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng });
  const density = useDensity(center);
  const sharingState = useSharing();
  const now = useNow(10_000);
  const mapStyle = useMapStyle(theme.scheme);

  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);

  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [locating, setLocating] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(CITY_ZOOM);
  const [city, setCity] = useState<City>(DEFAULT_CITY);
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sharing =
    consent.location && ['sharing', 'arriving', 'away', 'preparing'].includes(sharingState.status);

  const say = useCallback(
    (message: string) => {
      clearTimeout(toastTimer.current);
      setToast(message);
      toastTimer.current = setTimeout(() => setToast(null), theme.motion.toastDuration);
    },
    [theme.motion.toastDuration],
  );
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const flyTo = useCallback(
    (center: LngLat, zoom: number, overSheet = false) => {
      cameraRef.current?.easeTo({
        center,
        zoom,
        duration: reduceMotion ? 0 : theme.motion.camera,
        easing: 'ease',
        // Keep the target visible above the detail sheet.
        padding: { bottom: overSheet ? screenHeight * DETAIL_SNAP : 0 },
      });
    },
    [theme.motion.camera, screenHeight, reduceMotion],
  );

  /**
   * Centre on the phone's area. The privacy boundary only ever hands back a
   * cell id, so the camera flies to the cell centre, never to the exact spot.
   */
  const locate = useCallback(
    async ({ silent }: { silent: boolean }) => {
      if (locating) return;
      let state = await permissionState();
      if (state === 'undetermined' && !silent) state = await requestPermission();
      setPermission(state);
      if (state !== 'granted') {
        if (!silent) say('Location unavailable. Search for a city instead.');
        return;
      }
      setLocating(true);
      try {
        const fix = await acquireCoarseFix();
        flyTo(cellCenter(fix.cell), LOCATE_ZOOM);
      } catch {
        if (!silent) say('Location unavailable. Search for a city instead.');
      } finally {
        setLocating(false);
      }
    },
    [locating, flyTo, say],
  );

  // On open: centre on the phone's area only if permission was already given.
  // Never prompts on its own; the first prompt follows the consent screen.
  useEffect(() => {
    permissionState().then((state) => {
      setPermission(state);
      if (state === 'granted') locate({ silent: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The "me" dot marks the place the phone is at (the place's own position), only while sharing.
  const myPlace = consent.location ? sharingState.myPlace : null;

  const filtered = useMemo(
    () =>
      categories.length === 0
        ? density.places
        : density.places.filter((p) => categories.includes(p.category)),
    [density.places, categories],
  );

  const inView = useMemo(() => {
    if (!bounds) return filtered;
    const [w, s, e, n] = bounds;
    return filtered.filter((p) => p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n);
  }, [filtered, bounds]);

  const results = useMemo(() => searchCities(query), [query]);
  const venues = useVenues(bounds, zoom);
  const selectedLive = selection
    ? (density.places.find((p) => p.id === selection.id) ?? null)
    : null;

  const onRegionIsChanging = useCallback((e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    setBearing(e.nativeEvent.bearing);
  }, []);

  const onRegionDidChange = useCallback((e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { center, bounds: b, bearing: br, zoom: z } = e.nativeEvent;
    setBearing(br);
    setBounds(b);
    setZoom(z);
    setCenter({ lat: center[1], lng: center[0] });
    const near = nearestCity(center[1], center[0]);
    setCity((prev) => (prev.name === near.name ? prev : near));
  }, []);

  const pickCity = useCallback(
    (c: City) => {
      Keyboard.dismiss();
      setQuery('');
      setCity(c);
      flyTo([c.lng, c.lat], CITY_ZOOM);
    },
    [flyTo],
  );

  const toggleCategory = useCallback((key: Category | 'all') => {
    if (key === 'all') return setCategories([]);
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }, []);

  const focusPlace = useCallback(
    (place: LivePlace | VenuePin) => {
      const { id, name, category, kind, lng, lat } = place;
      setSelection({ id, name, category, kind, lng, lat });
      flyTo([lng, lat], Math.max(zoom, PLACE_ZOOM), true);
    },
    [flyTo, zoom],
  );

  const resetNorth = useCallback(async () => {
    const center = await mapRef.current?.getCenter();
    if (center) {
      cameraRef.current?.easeTo({
        center,
        bearing: 0,
        pitch: 0,
        duration: reduceMotion ? 0 : theme.motion.resetNorth,
      });
    }
  }, [theme.motion.resetNorth, reduceMotion]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.map.background }}>
      <Map
        ref={mapRef}
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        logo={false}
        // Twist with two fingers to rotate, like Google Maps. MapLibre's own
        // compass is off: MapControls draws the design's compass, whose needle
        // follows the bearing and which turns the map back to north on tap.
        touchRotate
        compass={false}
        attributionPosition={{
          bottom: sheetHeight + insets.bottom + 4,
          right: theme.layout.mapGutter,
        }}
        onRegionIsChanging={onRegionIsChanging}
        onRegionDidChange={onRegionDidChange}
        onPress={() => Keyboard.dismiss()}
        accessible
        accessibilityLabel="Crowd map. The Busiest now list below names the busiest places in view."
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [DEFAULT_CITY.lng, DEFAULT_CITY.lat], zoom: CITY_ZOOM }}
        />
        <VenueLayer pins={venues} onPress={focusPlace} />
        <HeatLayers
          places={filtered}
          selectedId={selection?.id ?? null}
          onPlacePress={(id) => {
            const hit = filtered.find((p) => p.id === id);
            if (hit) focusPlace(hit);
          }}
        />
        <MeDot at={myPlace?.center ?? null} />
      </Map>

      <MapTopBar
        query={query}
        onQueryChange={setQuery}
        results={results}
        onPickCity={pickCity}
        categories={categories}
        onToggleCategory={toggleCategory}
        sharing={sharing}
        onOpenInspector={() => router.push('/inspector')}
        onOpenSettings={() => router.push('/settings')}
      />

      <MapControls
        bearing={bearing}
        onResetNorth={resetNorth}
        onLocate={() => locate({ silent: false })}
        locationAvailable={permission !== 'denied'}
        locating={locating}
      />

      {inView.length === 0 && !selection && (
        <EmptyState variant={density.offline ? 'offline' : 'empty'} />
      )}

      {!selection && (
        <BusiestSheet
          places={inView}
          cityName={city.name}
          updatedLabel={ago(density.updatedAt, now)}
          open={sheetOpen}
          onToggle={() => setSheetOpen((v) => !v)}
          onPickPlace={focusPlace}
          onLayoutHeight={setSheetHeight}
        />
      )}

      <PlaceDetailSheet
        selection={selection}
        live={selectedLive}
        updatedLabel={ago(density.updatedAt, now)}
        onClose={() => setSelection(null)}
      />

      {toast && <Toast message={toast} top={insets.top + 58} />}
    </View>
  );
}
