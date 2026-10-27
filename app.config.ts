import type { ExpoConfig } from 'expo/config';

/**
 * Expo app config.
 *
 * The display name is a single constant so the store name can change without
 * touching anything else. The bundle identifier is permanent once the app
 * exists in App Store Connect, so it stays neutral.
 */
const APP_NAME = 'Pulse';
const BUNDLE_ID = 'com.moritzherb.pulse';

const config: ExpoConfig = {
  name: APP_NAME,
  slug: 'pulse',
  scheme: 'pulse',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Light and dark both supported; the in-app setting can override the system.
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    infoPlist: {
      // Foreground only. Shown by iOS after the in-app consent screen, never before.
      NSLocationWhenInUseUsageDescription:
        'Your position is turned into a ~460 m area on your phone. Only that area is sent, and only while the app is open.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Coarse + fine are both requested by expo-location; only foreground.
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    blockedPermissions: ['ACCESS_BACKGROUND_LOCATION'],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 120,
        backgroundColor: '#FFFFFF',
        dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#0B0B0C' },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Your position is turned into a ~460 m area on your phone. Only that area is sent, and only while the app is open.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    '@maplibre/maplibre-react-native',
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
