import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo app config.
 *
 * The display name is a single constant so the store name can change without
 * touching anything else. The bundle identifier is permanent once the app
 * exists in App Store Connect, so it stays neutral.
 */
const APP_NAME = 'Pulse';
const BUNDLE_ID = 'com.moritzherb.pulse';

/**
 * `config` is the content of app.json. It only holds what EAS writes there
 * (`eas init` adds the project id and owner); everything else is defined here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
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
    /**
     * Apple privacy manifest. Must match docs/store-privacy.md and the App
     * Store privacy label. Collected: coarse location (an H3 cell, ~460 m)
     * and a random rotating user ID, both only while sharing, for app
     * functionality, not linked to identity, no tracking.
     */
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCoarseLocation',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
      ],
      // Required-reason APIs used by React Native and Expo modules, declared
      // at app level as well for libraries that ship no manifest of their own.
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
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
    // expo-location adds the foreground permissions; background is blocked.
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
        // Never requested, so no usage strings for them in Info.plist.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        locationFullAccuracyPermission: false,
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
  extra: {
    ...config.extra,
  },
});
