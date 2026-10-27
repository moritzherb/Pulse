import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, LocateIcon, NeedleIcon, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface MapControlsProps {
  /** Map bearing in degrees; the needle counter-rotates to keep pointing north. */
  bearing: number;
  onResetNorth: () => void;
  onLocate: () => void;
  /** Grey locate icon when location is unavailable. */
  locationAvailable: boolean;
  locating: boolean;
}

/** Compass and locate-me, stacked on the right edge (design: right 14, top 168). */
export function MapControls({
  bearing,
  onResetNorth,
  onLocate,
  locationAvailable,
  locating,
}: MapControlsProps) {
  const { colors, layout, size, zIndex } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        right: layout.mapGutter,
        top: insets.top + layout.mapControlsTop,
        gap: 8,
        zIndex: zIndex.mapChrome,
      }}
    >
      <IconButton
        accessibilityLabel={
          Math.abs(bearing) < 1 ? 'Compass, facing north' : 'Compass. Double-tap to face north.'
        }
        onPress={onResetNorth}
      >
        <View
          style={{
            width: size.compassFace,
            height: size.compassFace,
            alignItems: 'center',
            transform: [{ rotate: `${-bearing}deg` }],
          }}
        >
          <NeedleIcon />
          <Text variant="monoCompass" color="muted" style={{ position: 'absolute', bottom: 1 }}>
            N
          </Text>
        </View>
      </IconButton>
      <IconButton
        accessibilityLabel={locationAvailable ? 'Show my area' : 'Location unavailable'}
        accessibilityState={{ busy: locating }}
        onPress={onLocate}
      >
        <LocateIcon color={locationAvailable ? colors.text.primary : colors.text.faint} />
      </IconButton>
    </View>
  );
}
