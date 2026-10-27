import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Required: icon-only controls must say what they do. */
  accessibilityLabel: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Round 44 pt white map control with the design's soft shadow. */
export function IconButton({ children, style, ...rest }: IconButtonProps) {
  const { colors, radius, size, shadows } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: size.control,
          height: size.control,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.surface.pressedSubtle : colors.surface.base,
          boxShadow: shadows.control,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
