import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/** The design's quiet info box: #fafafa fill, hairline border, 8 radius, 14 padding. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        {
          padding: 14,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border.hairline,
          backgroundColor: colors.surface.subtle,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
