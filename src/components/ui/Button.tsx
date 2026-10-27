import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  /**
   * primary   - black fill ("Share anonymously")
   * secondary - white with black border ("Just browse", "Rotate my ID now")
   * quiet     - white with grey border ("What my phone is sending")
   * danger    - white with red border ("Delete my data now")
   */
  variant?: ButtonVariant;
  /** 52 pt (consent) or 48 pt (settings). */
  size?: 'regular' | 'compact';
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  variant = 'primary',
  size = 'regular',
  style,
  ...rest
}: ButtonProps) {
  const { colors, radius, size: sizes } = useTheme();

  const look = {
    primary: {
      bg: colors.surface.inverse,
      bgPressed: colors.surface.inversePressed,
      border: colors.border.ink,
      text: 'inverse' as const,
    },
    secondary: {
      bg: colors.surface.base,
      bgPressed: colors.surface.pressed,
      border: colors.border.ink,
      text: 'primary' as const,
    },
    quiet: {
      bg: colors.surface.base,
      bgPressed: colors.surface.pressedSubtle,
      border: colors.border.strong,
      text: 'primary' as const,
    },
    danger: {
      bg: colors.surface.base,
      bgPressed: colors.surface.dangerPressed,
      border: colors.border.danger,
      text: 'danger' as const,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          minHeight: size === 'regular' ? sizes.button : sizes.buttonCompact,
          paddingHorizontal: 16,
          paddingVertical: 8,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: look.border,
          backgroundColor: pressed ? look.bgPressed : look.bg,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        variant={size === 'regular' ? 'button' : 'buttonCompact'}
        color={look.text}
        align="center"
      >
        {label}
      </Text>
    </Pressable>
  );
}
