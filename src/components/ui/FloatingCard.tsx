import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type ShadowToken } from '@/theme';

export interface FloatingCardProps {
  children: ReactNode;
  /** sheet: "Busiest now" (14 radius). card: empty state (10). popover: search results (12). */
  kind?: 'sheet' | 'card' | 'popover';
  style?: StyleProp<ViewStyle>;
}

/** White surface floating over the map. In dark mode it also gets a hairline. */
export function FloatingCard({ children, kind = 'sheet', style }: FloatingCardProps) {
  const { colors, radius, shadows, scheme } = useTheme();
  const r = { sheet: radius.sheet, card: radius.toast, popover: radius.popover }[kind];
  const shadow: ShadowToken = kind;
  return (
    <View
      style={[
        {
          borderRadius: r,
          backgroundColor: colors.surface.base,
          boxShadow: shadows[shadow],
          borderWidth: kind === 'card' || scheme === 'dark' ? 1 : 0,
          borderColor: colors.border.hairline,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
