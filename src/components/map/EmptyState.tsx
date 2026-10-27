import { View } from 'react-native';

import { FloatingCard, Text } from '@/components/ui';

const COPY = {
  empty: ['Not enough people here yet', 'Cells appear at five people or more.'],
  // fill-in: the design has no offline state. Same card, honest wording.
  offline: [
    'Can’t reach Pulse right now',
    'Nothing is shown rather than a guess. Retrying in the background.',
  ],
} as const;

/**
 * Shown when no cell in view clears the k-anonymity threshold, or when live
 * data cannot be loaded. Honest: no placeholder heat is ever invented.
 */
export function EmptyState({ variant = 'empty' }: { variant?: keyof typeof COPY }) {
  const [title, detail] = COPY[variant];
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        top: '42%',
        transform: [{ translateY: -40 }],
      }}
    >
      <FloatingCard
        kind="card"
        style={{ paddingVertical: 20, paddingHorizontal: 18, alignItems: 'center' }}
      >
        <Text
          variant="headline"
          align="center"
          style={{ paddingBottom: 6 }}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text variant="caption" color="tertiary" align="center">
          {detail}
        </Text>
      </FloatingCard>
    </View>
  );
}
