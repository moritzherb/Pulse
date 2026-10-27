import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FloatingCard,
  HeatLegend,
  LevelKey,
  LevelSwatch,
  Text,
  TrendGlyph,
  trendLabel,
} from '@/components/ui';
import { heatLevels, useTheme } from '@/theme';
import { HEAT_LEVELS } from '@shared/levels.ts';
import type { LivePlace } from '@shared/types.ts';

export interface BusiestSheetProps {
  /** Live places in view. */
  places: readonly LivePlace[];
  cityName: string;
  updatedLabel: string;
  open: boolean;
  onToggle: () => void;
  onPickPlace: (place: LivePlace) => void;
  onLayoutHeight?: (h: number) => void;
}

const MAX_ROWS = 5;

/**
 * The floating "Busiest now" card (design list variant A). Places by level
 * (busy for that place), then by count. Each row says the level in words,
 * so the list is the accessible version of the map.
 */
export function BusiestSheet(props: BusiestSheetProps) {
  const { colors, layout, zIndex } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [keyOpen, setKeyOpen] = useState(false);
  const rowMotion = reduceMotion
    ? {}
    : {
        layout: LinearTransition.duration(260),
        entering: FadeIn.duration(260),
        exiting: FadeOut.duration(180),
      };

  const rows = [...props.places]
    .sort(
      (a, b) =>
        HEAT_LEVELS.indexOf(b.level) - HEAT_LEVELS.indexOf(a.level) || b.devices - a.devices,
    )
    .slice(0, MAX_ROWS);

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
                // Keyed by place, so a row glides to its new rank instead of re-mounting.
                <Animated.View key={c.id} {...rowMotion}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name}. ${level}, about ${c.devices} people, ${trendLabel(c.trend)}.`}
                    onPress={() => props.onPickPlace(c)}
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
                        {c.name}
                      </Text>
                      <Text
                        variant="monoSub"
                        color="muted"
                        numberOfLines={1}
                        style={{ paddingTop: 2 }}
                      >
                        {`${level} · ${c.kind ?? c.category}`}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text variant="monoData" style={{ minWidth: 34, textAlign: 'right' }}>
                        ~{c.devices}
                      </Text>
                      <TrendGlyph trend={c.trend} />
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: keyOpen }}
              accessibilityHint={keyOpen ? 'Hides the key' : 'Shows what each pattern means'}
              onPress={() => setKeyOpen((v) => !v)}
              style={{ paddingTop: 14, paddingBottom: 2 }}
            >
              <HeatLegend />
            </Pressable>
            {keyOpen && (
              // fill-in: the four levels with their patterns, so the map can be read without colour.
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(200)}
                style={{ paddingTop: 12 }}
              >
                <LevelKey />
              </Animated.View>
            )}
          </ScrollView>
        )}
      </FloatingCard>
    </Animated.View>
  );
}
