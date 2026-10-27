import { View } from 'react-native';

import { heatLevelOrder, heatLevels, heatRamp, useTheme } from '@/theme';

import { LevelSwatch } from './LevelSwatch';
import { Text } from './Text';

const gradient = `linear-gradient(to right, ${heatRamp.map((s) => s.color).join(', ')})`;

/** The design's legend: 6 pt gradient bar + "QUIET → PACKED". */
export function HeatLegend() {
  const { radius, size } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Legend: colours run from blue for quiet to red for packed."
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View
        style={{
          height: size.legendBar,
          flex: 1,
          borderRadius: radius.swatch,
          backgroundImage: gradient,
        }}
      />
      <Text variant="monoLegend" color="muted" numberOfLines={1}>
        quiet → packed
      </Text>
    </View>
  );
}

/**
 * fill-in: the four named levels with their patterns, so the legend can be
 * read without colour. Shown in the detail sheet and the expanded legend.
 */
export function LevelKey() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8 }}>
      {heatLevelOrder.map((level) => (
        <View key={level} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LevelSwatch level={level} />
          <Text variant="monoLegend" color="secondary">
            {heatLevels[level].label}
          </Text>
        </View>
      ))}
    </View>
  );
}
