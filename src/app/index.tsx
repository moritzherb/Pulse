import { Redirect } from 'expo-router';

import { useConsent } from '@/features/consent/consent';
import { MapScreen } from '@/features/map/MapScreen';

/**
 * Entry point. Nobody reaches the map before making a choice on the consent
 * screen, and the location prompt never appears behind it.
 */
export default function Index() {
  const consent = useConsent();
  if (!consent.decided) return <Redirect href="/onboarding" />;
  return <MapScreen />;
}
