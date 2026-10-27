import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, IconButton, RingIcon, SharingPill, Text } from '@/components/ui';
import type { City } from '@/data/cities';
import { useTheme } from '@/theme';
import type { Category } from '@shared/types.ts';

export const CATEGORY_CHIPS: readonly { key: Category | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'food', label: 'Food' },
  { key: 'sights', label: 'Sights' },
  { key: 'outdoors', label: 'Outdoors' },
];

export interface MapTopBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: readonly City[];
  onPickCity: (city: City) => void;
  categories: readonly Category[];
  onToggleCategory: (key: Category | 'all') => void;
  sharing: boolean;
  onOpenInspector: () => void;
  onOpenSettings: () => void;
}

/**
 * Top of the map: search field, "{}" inspector and settings buttons, then
 * the category chips (replaced by search results while typing). Sits on the
 * design's white fade so it reads over any map.
 */
export function MapTopBar(props: MapTopBarProps) {
  const { colors, layout, radius, shadows, size, type, zIndex } = useTheme();
  const insets = useSafeAreaInsets();
  const hasResults = props.results.length > 0;

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + layout.screenTopExtra.map,
          paddingHorizontal: layout.mapGutter,
          paddingBottom: 26,
          backgroundImage: colors.map.topFade,
          zIndex: zIndex.mapChrome,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 8 }}>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              height: size.control,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              backgroundColor: colors.surface.base,
              boxShadow: shadows.control,
            }}
          >
            <RingIcon color={colors.text.muted} />
            <TextInput
              value={props.query}
              onChangeText={props.onQueryChange}
              placeholder="Search a city"
              placeholderTextColor={colors.text.muted}
              accessibilityLabel="Search a city"
              autoCorrect={false}
              returnKeyType="search"
              maxFontSizeMultiplier={type.label.maxScale}
              onSubmitEditing={() => {
                const first = props.results[0];
                if (first) props.onPickCity(first);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                padding: 0,
                fontFamily: type.label.fontFamily,
                fontSize: type.label.fontSize,
                color: colors.text.primary,
              }}
            />
            {props.query.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={10}
                onPress={() => props.onQueryChange('')}
                style={{ paddingHorizontal: 2 }}
              >
                <Text variant="headline" color="muted" style={{ fontSize: 15 }}>
                  ×
                </Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconButton
              accessibilityLabel="What my phone is sending"
              onPress={props.onOpenInspector}
            >
              <Text variant="monoButton">{'{}'}</Text>
            </IconButton>
            <IconButton accessibilityLabel="Settings" onPress={props.onOpenSettings}>
              <RingIcon />
            </IconButton>
          </View>
        </View>

        {!hasResults && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Let chip shadows breathe instead of being clipped.
            style={{ marginHorizontal: -layout.mapGutter, overflow: 'visible' }}
            contentContainerStyle={{
              gap: 6,
              paddingHorizontal: layout.mapGutter,
              paddingBottom: 2,
            }}
          >
            {CATEGORY_CHIPS.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                active={
                  c.key === 'all' ? props.categories.length === 0 : props.categories.includes(c.key)
                }
                onPress={() => props.onToggleCategory(c.key)}
              />
            ))}
            {props.sharing && <SharingPill onPress={props.onOpenSettings} />}
          </ScrollView>
        )}
      </View>

      {hasResults && (
        <View
          accessibilityRole="list"
          style={{
            position: 'absolute',
            top: insets.top + 52,
            left: layout.mapGutter,
            right: 116,
            borderRadius: radius.popover,
            backgroundColor: colors.surface.base,
            boxShadow: shadows.popover,
            overflow: 'hidden',
            zIndex: zIndex.popover,
          }}
        >
          {props.results.map((city) => (
            <Pressable
              key={city.name}
              accessibilityRole="button"
              accessibilityLabel={`${city.name}, ${city.country}`}
              onPress={() => props.onPickCity(city)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderTopWidth: 1,
                borderTopColor: colors.border.dividerLight,
                backgroundColor: pressed ? colors.surface.subtle : colors.surface.base,
              })}
            >
              <Text variant="label">{city.name}</Text>
              <Text variant="small" color="muted">
                {city.country}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}
