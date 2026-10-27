import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { Arimo_400Regular } from '@expo-google-fonts/arimo/400Regular';
import { Arimo_500Medium } from '@expo-google-fonts/arimo/500Medium';
import { Platform } from 'react-native';

/**
 * Font files loaded at startup. Keys are the family names used in
 * typography.ts. Helvetica Neue is a system font on iOS, so Arimo is only
 * loaded on Android.
 */
export const fontAssets = {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  ...(Platform.OS === 'ios' ? {} : { Arimo_400Regular, Arimo_500Medium }),
};
