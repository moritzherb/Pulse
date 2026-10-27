import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

/** Outline mono pill: "no coordinates", "20 min" (consent variant B). */
export function Badge({ label }: { label: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: colors.border.badge,
        borderRadius: radius.pill,
      }}
    >
      <Text variant="monoBadge" color="secondary">
        {label}
      </Text>
    </View>
  );
}

/** Filled, struck-through pill for data that never leaves the phone. */
export function StrikePill({ label }: { label: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, never sent`}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderRadius: radius.pill,
        backgroundColor: colors.surface.sunken,
      }}
    >
      <Text variant="caption" color="secondary" strike style={{ lineHeight: undefined }}>
        {label}
      </Text>
    </View>
  );
}
