import { Redirect } from 'expo-router';

/**
 * Phase 1a entry point: until the real screens land, development builds open
 * the design-token gallery.
 */
export default function Index() {
  return <Redirect href="/dev/tokens" />;
}
