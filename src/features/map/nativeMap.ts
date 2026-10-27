import { TurboModuleRegistry } from 'react-native';

/**
 * Whether this app binary contains MapLibre's native code. False inside Expo
 * Go (which can't include it) or a build made without the MapLibre plugin.
 * Checked without importing MapLibre, whose JS throws on import when the
 * native side is missing.
 */
export const nativeMapAvailable = TurboModuleRegistry.get('MLRNCameraModule') != null;
