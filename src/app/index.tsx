import { Redirect } from 'expo-router';

import { Screen } from '@/components/screen/Screen';
import { Card, Text } from '@/components/ui';
import { useConsent } from '@/features/consent/consent';
import { nativeMapAvailable } from '@/features/map/nativeMap';
import type { MapScreen as MapScreenType } from '@/features/map/MapScreen';

// Loaded only when the native map exists: importing MapLibre without its
// native code throws, which would take the whole app down (e.g. in Expo Go).
const MapScreen: typeof MapScreenType | null = nativeMapAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/map/MapScreen') as typeof import('@/features/map/MapScreen')).MapScreen
  : null;

/**
 * Entry point. Nobody reaches the map before making a choice on the consent
 * screen, and the location prompt never appears behind it.
 */
export default function Index() {
  const consent = useConsent();
  if (!consent.decided) return <Redirect href="/onboarding" />;
  if (!MapScreen) return <NeedsPulseBuild />;
  return <MapScreen />;
}

/** Shown instead of a crash when the app runs somewhere without the native map. */
function NeedsPulseBuild() {
  return (
    <Screen topExtra={54}>
      <Text variant="title" accessibilityRole="header" style={{ marginBottom: 12 }}>
        Open Pulse in its own app
      </Text>
      <Card>
        <Text variant="body">
          This is Expo Go (or a build without the map), which can’t show Pulse’s map. Install the
          Pulse development build and open that app instead: it has the Pulse icon and lists your
          computer under “Development servers”.
        </Text>
        <Text variant="monoCaption" color="muted" style={{ paddingTop: 10 }}>
          See docs/try-it.md, step 3.
        </Text>
      </Card>
    </Screen>
  );
}
