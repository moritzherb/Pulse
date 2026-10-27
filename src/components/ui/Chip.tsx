import { Pressable, type PressableProps } from 'react-native';

import { useTheme } from '@/theme';

import { LiveDot } from './LiveDot';
import { Text } from './Text';

export interface ChipProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  active?: boolean;
}

/** Category filter chip on the map: 44 tall pill, inverts when active. */
export function Chip({ label, active = false, ...rest }: ChipProps) {
  const { colors, radius, size, shadows } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} filter`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        minHeight: size.control,
        paddingHorizontal: 15,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.border.ink : colors.border.strong,
        backgroundColor: active
          ? colors.surface.inverse
          : pressed
            ? colors.surface.pressedSubtle
            : colors.surface.base,
        boxShadow: shadows.chip,
      })}
      {...rest}
    >
      <Text variant="callout" color={active ? 'inverse' : 'primary'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** "● SHARING" pill shown next to the chips while location sharing is on. */
export function SharingPill(props: Omit<PressableProps, 'style' | 'children'>) {
  const { colors, radius, size, shadows } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sharing is on. Opens settings."
      style={({ pressed }) => ({
        minHeight: size.control,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 13,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border.strong,
        backgroundColor: pressed ? colors.surface.pressedSubtle : colors.surface.base,
        boxShadow: shadows.chip,
      })}
      {...props}
    >
      <LiveDot />
      <Text variant="monoTag" color="body">
        Sharing
      </Text>
    </Pressable>
  );
}
