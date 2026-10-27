import { useTheme } from '@/theme';

import { Text } from './Text';

export type Trend = -1 | 0 | 1;

const glyph: Record<Trend, string> = { 1: '↑', 0: '·', [-1]: '↓' };
const spoken: Record<Trend, string> = { 1: 'getting busier', 0: 'steady', [-1]: 'getting quieter' };

/** Mono trend arrow from the "Busiest now" list: ↑ red, ↓ teal, · grey. */
export function TrendGlyph({ trend }: { trend: Trend }) {
  const { colors } = useTheme();
  const color = trend > 0 ? colors.trend.up : trend < 0 ? colors.trend.down : colors.trend.flat;
  return (
    <Text
      variant="monoGlyph"
      accessibilityLabel={spoken[trend]}
      style={{ width: 12, textAlign: 'center', color }}
    >
      {glyph[trend]}
    </Text>
  );
}

export function trendLabel(trend: Trend): string {
  return spoken[trend];
}
