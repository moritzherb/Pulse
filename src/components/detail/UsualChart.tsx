import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Text } from '@/components/ui';
import { dayBars, daySummary, WEEKDAYS } from '@/features/detail/usual';
import type { UsualPoint } from '@/features/detail/types';
import { useTheme } from '@/theme';
import { K_ANONYMITY } from '@shared/levels.ts';

export interface UsualChartProps {
  hours: readonly UsualPoint[];
  /** ISO weekday shown first (today). */
  initialDay: number;
  /** Local hour to highlight on today's chart. */
  currentHour: number;
  today: number;
}

const HEIGHT = 72;
const GAP = 2;
const TICKS = [0, 6, 12, 18];

/**
 * "Usually busy at": typical crowd per hour for one weekday. fill-in: not in
 * the design. Built from the design's vocabulary: mono weekday tabs, neutral
 * bars, ink for the current hour, mono axis labels. Hours that never clear
 * k = 5 are drawn as a hairline stub, not as zero-height gaps.
 */
export function UsualChart({ hours, initialDay, currentHour, today }: UsualChartProps) {
  const { colors } = useTheme();
  const [day, setDay] = useState(initialDay);
  const [width, setWidth] = useState(0);
  const bars = dayBars(hours, day);
  const max = Math.max(K_ANONYMITY * 2, ...bars);
  const barW = width > 0 ? (width - GAP * 23) / 24 : 0;
  const summary = daySummary(bars, day);

  return (
    <View>
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14 }}
      >
        {WEEKDAYS.map((name, i) => {
          const d = i + 1;
          const active = d === day;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityLabel={name}
              accessibilityState={{ selected: active }}
              hitSlop={6}
              onPress={() => setDay(d)}
              style={{
                paddingVertical: 4,
                borderBottomWidth: 1.5,
                borderBottomColor: active ? colors.border.ink : 'transparent',
              }}
            >
              <Text variant="monoTag" color={active ? 'primary' : 'muted'}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {bars.map((v, h) => {
              const isNow = day === today && h === currentHour;
              const visible = v >= K_ANONYMITY;
              const barH = visible ? Math.max(3, (v / max) * HEIGHT) : 1;
              return (
                <Rect
                  key={h}
                  x={h * (barW + GAP)}
                  y={HEIGHT - barH}
                  width={barW}
                  height={barH}
                  rx={visible ? 1.5 : 0}
                  fill={
                    isNow
                      ? colors.text.primary
                      : visible
                        ? colors.border.strong
                        : colors.border.hairline
                  }
                />
              );
            })}
          </Svg>
        )}
      </View>

      <View style={{ height: 16, marginTop: 6 }} importantForAccessibility="no-hide-descendants">
        {width > 0 &&
          TICKS.map((h) => (
            <Text
              key={h}
              variant="monoLegend"
              color="muted"
              style={{ position: 'absolute', left: h * (barW + GAP) }}
            >
              {String(h).padStart(2, '0')}
            </Text>
          ))}
      </View>
      <Text variant="caption" color="tertiary" style={{ paddingTop: 8 }}>
        {summary}
      </Text>
    </View>
  );
}
