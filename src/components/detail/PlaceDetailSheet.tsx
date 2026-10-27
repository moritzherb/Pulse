import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, LevelSwatch, SectionLabel, Text, TrendGlyph, trendLabel } from '@/components/ui';
import type { Selection } from '@/features/detail/types';
import { useCellDetail } from '@/features/detail/useCellDetail';
import { dayBars, isoDay, nowVsUsual, WEEKDAYS_LONG } from '@/features/detail/usual';
import { heatLevels, useTheme } from '@/theme';
import type { LiveCell } from '@shared/types.ts';

import { UsualChart } from './UsualChart';

export interface CellDetailSheetProps {
  selection: Selection | null;
  /** Current state of the selected cell from the live map data (null under k). */
  live: LiveCell | null;
  updatedLabel: string;
  onClose: () => void;
}

/** Fraction of the screen the sheet first opens to; the map pads its camera by this. */
export const DETAIL_SNAP = 0.5;

/**
 * Cell / venue detail. fill-in: the design has no detail sheet. It follows
 * the design's floating-card language: 14 pt margins and radius, the sheet
 * shadow, mono section labels and meta lines, the 10 pt swatch scaled up.
 */
export function CellDetailSheet({ selection, live, updatedLabel, onClose }: CellDetailSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [`${DETAIL_SNAP * 100}%`, '88%'], []);

  useEffect(() => {
    if (selection) ref.current?.snapToIndex(0);
    else ref.current?.close();
  }, [selection]);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={onClose}
      detached
      bottomInset={Math.max(insets.bottom + theme.layout.sheetBottomOffset, 16)}
      style={{ marginHorizontal: theme.layout.mapGutter }}
      backgroundComponent={SheetBackground}
      handleComponent={SheetHandle}
    >
      {selection && (
        <Content selection={selection} live={live} updatedLabel={updatedLabel} onClose={onClose} />
      )}
    </BottomSheet>
  );
}

function Content({
  selection,
  live,
  updatedLabel,
  onClose,
}: Required<Omit<CellDetailSheetProps, 'selection'>> & { selection: Selection }) {
  const { colors } = useTheme();
  const state = useCellDetail(selection.cell);
  const detail = state.status === 'ready' ? state.detail : null;
  const now = new Date();
  const today = isoDay(now);
  const hour = now.getHours();

  const area = live?.label ?? detail?.label ?? null;
  const title = selection.venue?.name ?? area ?? 'This area';
  const meta = [
    selection.venue ? (selection.venue.kind ?? selection.venue.category) : (live?.category ?? null),
    selection.venue && area ? `in ${area}` : '~460 m area',
  ]
    .filter(Boolean)
    .join(' · ');

  // Tell VoiceOver / TalkBack users what opened; the map itself is not navigable.
  const spoken = live
    ? `${title}. ${heatLevels[live.level].label} right now.`
    : `${title}. Not enough data right now.`;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`Details: ${spoken}`);
    // Announce once per opened place, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.cell, selection.venue?.name]);

  const usualNow = detail ? (dayBars(detail.usual.hours, today)[hour] ?? 0) : 0;
  const compare = nowVsUsual(live?.devices ?? null, usualNow);
  const compareCopy = compare
    ? `${compare === 'busier' ? 'Busier than' : compare === 'quieter' ? 'Quieter than' : 'About as busy as'} usual for ${WEEKDAYS_LONG[today - 1]} at ${String(hour).padStart(2, '0')}:00.`
    : null;

  return (
    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 14 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="headline" accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
          <Text variant="monoMeta" color="muted" numberOfLines={1} style={{ paddingTop: 4 }}>
            {meta} · updated {updatedLabel}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close details"
          hitSlop={8}
          onPress={onClose}
          style={{ padding: 6 }}
        >
          <Text variant="monoAction">Close</Text>
        </Pressable>
      </View>

      {live ? (
        <View
          accessible
          accessibilityLabel={`${heatLevels[live.level].label} right now, about ${live.devices} people, ${trendLabel(live.trend)}.`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <LevelSwatch level={live.level} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="title">{heatLevels[live.level].label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 }}>
              <Text variant="monoData">~{live.devices} people</Text>
              <TrendGlyph trend={live.trend} />
              <Text variant="caption" color="tertiary">
                {trendLabel(live.trend)}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <Card>
          <Text variant="rowTitle">Not enough data right now</Text>
          <Text variant="caption" color="tertiary" style={{ paddingTop: 3 }}>
            Fewer than five people shared from here in the last 15 minutes, so nothing is shown.
          </Text>
        </Card>
      )}
      {compareCopy && (
        <Text variant="caption" color="tertiary" style={{ paddingTop: 10 }}>
          {compareCopy}
        </Text>
      )}

      <SectionLabel>Usually</SectionLabel>
      {state.status === 'loading' && (
        <Text variant="caption" color="muted">
          Loading…
        </Text>
      )}
      {state.status === 'error' && (
        <Text variant="caption" color="tertiary">
          History is unavailable right now.
        </Text>
      )}
      {detail &&
        (detail.usual.hours.length > 0 ? (
          <UsualChart
            hours={detail.usual.hours}
            initialDay={today}
            today={today}
            currentHour={hour}
          />
        ) : (
          <Card>
            <Text variant="caption" color="tertiary">
              Not enough history yet. The chart appears after three weeks of data
              {detail.usual.weeks > 0 ? ` (${detail.usual.weeks} so far)` : ''}.
            </Text>
          </Card>
        ))}

      {detail && detail.venues.length > 0 && (
        <>
          <SectionLabel>In this area</SectionLabel>
          <View>
            {detail.venues.map((v, i) => (
              <View
                key={v.id}
                accessible
                accessibilityLabel={`${v.name}, ${v.kind ?? v.category}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border.divider,
                }}
              >
                <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
                  {v.name}
                </Text>
                <Text variant="monoSub" color="muted">
                  {v.kind ?? v.category}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text variant="monoFootnote" color="muted" style={{ paddingTop: 22 }}>
        Different phones in the last 15 min, rounded to 5. Areas under five are never shown. Venues
        © OpenStreetMap contributors.
      </Text>
    </BottomSheetScrollView>
  );
}

function SheetBackground({ style }: BottomSheetBackgroundProps) {
  const { colors, radius, shadows, scheme } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        style,
        {
          borderRadius: radius.sheet,
          backgroundColor: colors.surface.base,
          boxShadow: shadows.sheet,
          borderWidth: scheme === 'dark' ? 1 : 0,
          borderColor: colors.border.hairline,
        },
      ]}
    />
  );
}

function SheetHandle() {
  const { colors } = useTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 10 }}
    >
      <View
        style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border.strong }}
      />
    </View>
  );
}
