import { Pressable, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

import { Text } from './Text';
import { Toggle } from './Toggle';

export interface ToggleRowProps {
  label: string;
  /** Sans helper line (consent screen). */
  detail?: string;
  /** Mono timestamp line (settings: "on · 2026-07-01"). Replaces `detail`. */
  stamp?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

/** A consent purpose row: title, helper line, switch. The whole row toggles. */
export function ToggleRow({ label, detail, stamp, value, onChange }: ToggleRowProps) {
  const { colors, size } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      onPress={() => {
        haptic.select();
        onChange(!value);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 14,
        minHeight: size.rowMinHeight,
        backgroundColor: pressed ? colors.surface.subtle : colors.surface.base,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="rowTitle" style={{ paddingBottom: 4 }}>
          {label}
        </Text>
        {stamp ? (
          <Text variant="monoCaption" color="muted">
            {stamp}
          </Text>
        ) : detail ? (
          <Text variant="caption" color="tertiary">
            {detail}
          </Text>
        ) : null}
      </View>
      <Toggle value={value} />
    </Pressable>
  );
}
