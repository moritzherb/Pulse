import { View } from 'react-native';

import { FloatingCard, Text } from '@/components/ui';

/**
 * Shown when no cell in view clears the k-anonymity threshold. Honest: no
 * placeholder heat is ever invented.
 */
export function EmptyState() {
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
          Not enough people here yet
        </Text>
        <Text variant="caption" color="tertiary" align="center">
          Cells appear at five people or more.
        </Text>
      </FloatingCard>
    </View>
  );
}
