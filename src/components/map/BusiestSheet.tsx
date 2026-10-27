import { Pressable, ScrollView, View } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FloatingCard,
  HeatLegend,
  LevelSwatch,
  Text,
  TrendGlyph,
  trendLabel,
} from '@/components/ui';
import { heatLevels, useTheme } from '@/theme';
import type { LiveCell } from '@shared/types.ts';

export interface BusiestSheetProps {
  /** Cells in view, busiest first. */
  cells: readonly LiveCell[];
  cityName: string;
  updatedLabel: string;
  open: boolean;
  onToggle: () => void;
  onPickCell: (cell: LiveCell) => void;
  onLayoutHeight?: (h: number) => void;
}

const MAX_ROWS = 5;

/**
 * The floating "Busiest now" card (design list variant A). Adjacent cells
 * that share a place name collapse into one row. Each row says the level in
 * words, so the list is the accessible version of the map.
 */
export function BusiestSheet(props: BusiestSheetProps) {
  const { colors, layout, zIndex } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const rows: LiveCell[] = [];
  const seen = new Set<string>();
  for (const c of props.cells) {
    if (rows.length >= MAX_ROWS) break;
    const key = c.label ?? c.cell;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(c);
  }

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(220)}
      onLayout={(e) => props.onLayoutHeight?.(e.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        left: layout.mapGutter,
        right: layout.mapGutter,
        bottom: Math.max(insets.bottom + layout.sheetBottomOffset, 16),
        maxHeight: '56%',
        zIndex: zIndex.sheet,
      }}
    >
      <FloatingCard
        style={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: 14, flexShrink: 1 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Busiest now, ${props.cityName}, updated ${props.updatedLabel}`}
          accessibilityHint={props.open ? 'Hides the list' : 'Shows the list'}
          accessibilityState={{ expanded: props.open }}
          onPress={props.onToggle}
          style={{
            minHeight: 36,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            <Text variant="label" numberOfLines={1}>
              Busiest now
            </Text>
            <Text variant="monoMeta" color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {props.cityName} · updated {props.updatedLabel}
            </Text>
          </View>
          <Text variant="monoTag">{props.open ? 'Hide' : 'Show'}</Text>
        </Pressable>

        {props.open && (
          <ScrollView style={{ paddingTop: 6 }} bounces={false}>
            {rows.length === 0 && (
              <Text variant="footnote" color="tertiary" style={{ paddingTop: 6, paddingBottom: 2 }}>
                Nothing clears the threshold in view.
              </Text>
            )}
            {rows.map((c) => {
              const level = heatLevels[c.level].label;
              return (
                <Pressable
                  key={c.cell}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label ?? 'Unnamed area'}. ${level}, about ${c.devices} people, ${trendLabel(c.trend)}.`}
                  onPress={() => props.onPickCell(c)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 11,
                    borderTopWidth: 1,
                    borderTopColor: colors.border.divider,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <LevelSwatch level={c.level} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="callout" numberOfLines={1}>
                      {c.label ?? 'Unnamed area'}
                    </Text>
                    <Text
                      variant="monoSub"
                      color="muted"
                      numberOfLines={1}
                      style={{ paddingTop: 2 }}
                    >
                      {c.category ? `${level} · ${c.category}` : level}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="monoData" style={{ minWidth: 34, textAlign: 'right' }}>
                      ~{c.devices}
                    </Text>
                    <TrendGlyph trend={c.trend} />
                  </View>
                </Pressable>
              );
            })}
            <View style={{ paddingTop: 14, paddingBottom: 2 }}>
              <HeatLegend />
            </View>
          </ScrollView>
        )}
      </FloatingCard>
    </Animated.View>
  );
}
