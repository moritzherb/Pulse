import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Extra top offset beyond the safe area: consent 6, settings 0. */
  topExtra?: number;
}

/** Full-page scrolling screen with the design's 22 pt side padding. */
export function Screen({ children, topExtra = 0 }: ScreenProps) {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.base }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + topExtra,
          paddingBottom: insets.bottom + layout.screenBottomExtra,
          paddingHorizontal: layout.screenPaddingX,
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** "← Map" / "← Back" text link at the top of a sub-page. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label === 'Back' ? 'previous screen' : label}`}
      hitSlop={8}
      onPress={onPress}
      style={{ alignSelf: 'flex-start', paddingTop: 6, paddingBottom: 16 }}
    >
      <Text variant="label">← {label}</Text>
    </Pressable>
  );
}

/** "Policy 2026-10-28 · Privacy policy" footer line. */
export function PolicyFooter({
  version,
  onOpenPolicy,
}: {
  version: string;
  onOpenPolicy: () => void;
}) {
  return (
    <Text variant="monoFootnote" color="muted" style={{ paddingTop: 18 }}>
      Policy {version} ·{' '}
      <Text
        variant="monoFootnote"
        accessibilityRole="link"
        onPress={onOpenPolicy}
        style={{ textDecorationLine: 'underline' }}
      >
        Privacy policy
      </Text>
    </Text>
  );
}
