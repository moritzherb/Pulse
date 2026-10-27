import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  Chip,
  FloatingCard,
  GroupedList,
  HeatLegend,
  IconButton,
  LevelKey,
  LevelSwatch,
  LocateIcon,
  NeedleIcon,
  RingIcon,
  SectionLabel,
  SharingPill,
  StatusCard,
  StrikePill,
  Text,
  Toast,
  ToggleRow,
  TrendGlyph,
} from '@/components/ui';
import {
  heatLevelOrder,
  heatLevels,
  heatRamp,
  radius,
  space,
  useTheme,
  useThemePreference,
  type ColorTokens,
  type ThemePreference,
  type TypeVariant,
} from '@/theme';

/**
 * Development-only gallery of every design token and core component, rendered
 * with the real theme on a real device. Not reachable in release builds.
 */
export default function TokensScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}

function Gallery() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useThemePreference();
  const [toggles, setToggles] = useState({ a: true, b: false });
  const [chip, setChip] = useState('All');
  const [toast, setToast] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + theme.layout.screenTopExtra.settings,
          paddingBottom: insets.bottom + theme.layout.screenBottomExtra + 24,
          paddingHorizontal: theme.layout.screenPaddingX,
        }}
      >
        <Text variant="title" accessibilityRole="header" style={{ marginBottom: 4 }}>
          Design tokens
        </Text>
        <Text variant="monoFootnote" color="muted">
          Extracted from design/Pulse.dc.html · dev build only
        </Text>

        <SectionLabel>Appearance</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((p) => (
            <Chip
              key={p}
              label={p[0]!.toUpperCase() + p.slice(1)}
              active={preference === p}
              onPress={() => setPreference(p)}
            />
          ))}
        </View>

        <SectionLabel>Colour · text</SectionLabel>
        <ColorGroup group="text" colors={theme.colors} />
        <SectionLabel>Colour · surface</SectionLabel>
        <ColorGroup group="surface" colors={theme.colors} />
        <SectionLabel>Colour · border</SectionLabel>
        <ColorGroup group="border" colors={theme.colors} />
        <SectionLabel>Colour · status, trend, control</SectionLabel>
        <ColorGroup group="status" colors={theme.colors} />
        <ColorGroup group="trend" colors={theme.colors} />
        <ColorGroup group="control" colors={theme.colors} />

        <SectionLabel>Heat ramp (design)</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {heatRamp.map((s) => (
            <View key={s.color} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 28, borderRadius: radius.swatch, backgroundColor: s.color }} />
              <Text variant="monoLegend" color="muted">
                {s.at}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ height: 12 }} />
        <HeatLegend />

        <SectionLabel>Levels (colour + pattern)</SectionLabel>
        <GroupedList>
          {heatLevelOrder.map((level) => (
            <Row key={level}>
              <LevelSwatch level={level} size={28} />
              <View style={{ flex: 1 }}>
                <Text variant="rowTitle">{heatLevels[level].label}</Text>
                <Text variant="monoCaption" color="muted">
                  {heatLevels[level].color} · {heatLevels[level].pattern}
                </Text>
              </View>
              <LevelSwatch level={level} />
            </Row>
          ))}
        </GroupedList>
        <View style={{ height: 12 }} />
        <LevelKey />

        <SectionLabel>Type scale</SectionLabel>
        <View style={{ gap: 14 }}>
          {(Object.keys(theme.type) as TypeVariant[]).map((v) => {
            const t = theme.type[v];
            return (
              <View key={v}>
                <Text variant="monoSub" color="muted" style={{ paddingBottom: 3 }}>
                  {v} · {t.fontSize}/{t.lineHeight} · {t.letterSpacing}pt · max ×{t.maxScale}
                </Text>
                <Text variant={v}>
                  {v.startsWith('mono') ? 'Policy 2026-07-01' : 'See how busy places are'}
                </Text>
              </View>
            );
          })}
        </View>

        <SectionLabel>Spacing</SectionLabel>
        <View style={{ gap: 6 }}>
          {Object.values(space)
            .filter((n) => n >= 4)
            .map((n) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text variant="monoSub" color="muted" style={{ width: 28 }}>
                  {n}
                </Text>
                <View
                  style={{ width: n * 4, height: 8, backgroundColor: theme.colors.text.primary }}
                />
              </View>
            ))}
        </View>

        <SectionLabel>Radii + shadows</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 8 }}>
          {(Object.keys(theme.shadows) as (keyof typeof theme.shadows)[]).map((k) => (
            <View key={k} style={{ alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: k === 'control' || k === 'chip' ? radius.pill : radius.toast,
                  backgroundColor: theme.colors.surface.base,
                  boxShadow: theme.shadows[k],
                }}
              />
              <Text variant="monoSub" color="muted">
                {k}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="monoSub" color="muted" style={{ paddingTop: 8 }}>
          radius:{' '}
          {Object.entries(radius)
            .map(([k, v]) => `${k} ${v}`)
            .join(' · ')}
        </Text>

        <SectionLabel>Buttons</SectionLabel>
        <View style={{ gap: 10 }}>
          <Button label="Share anonymously" variant="primary" />
          <Button label="Just browse" variant="secondary" />
          <Button label="Rotate my ID now" variant="secondary" size="compact" />
          <Button label="What my phone is sending" variant="quiet" size="compact" />
          <Button label="Delete my data now" variant="danger" size="compact" />
        </View>

        <SectionLabel variant="wide">Each one separate</SectionLabel>
        <GroupedList>
          <ToggleRow
            label="Share my area"
            detail="A ~460 m cell, while open."
            value={toggles.a}
            onChange={(a) => setToggles((s) => ({ ...s, a }))}
          />
          <ToggleRow
            label="Share my area"
            stamp={toggles.b ? 'on · 2026-10-27' : 'off'}
            value={toggles.b}
            onChange={(b) => setToggles((s) => ({ ...s, b }))}
          />
        </GroupedList>

        <SectionLabel>Cards, badges, status</SectionLabel>
        <StatusCard
          status="sharing"
          title="Sharing on"
          detail="A cell every 3 min. 2 row(s), all expiring within 20 min."
        />
        <View style={{ height: 8 }} />
        <StatusCard status="off" title="Sharing off" detail="Nothing is sent. Full map access." />
        <View style={{ height: 8 }} />
        <Card>
          <Text variant="monoId">cad3693a-5153-439b-8e80-6f3b10d2abcd</Text>
          <Text variant="monoSub" color="muted" style={{ paddingTop: 6 }}>
            rotates 2026-10-28
          </Text>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 16 }}>
          <Badge label="no coordinates" />
          <Badge label="20 min" />
          <Badge label="no device ID" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 10 }}>
          <StrikePill label="your address" />
          <StrikePill label="your name" />
          <StrikePill label="any history" />
        </View>

        <SectionLabel>Map controls</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {['All', 'Nightlife', 'Food'].map((c) => (
            <Chip key={c} label={c} active={chip === c} onPress={() => setChip(c)} />
          ))}
          <SharingPill />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 12 }}>
          <IconButton accessibilityLabel="Open settings">
            <RingIcon />
          </IconButton>
          <IconButton accessibilityLabel="What's sent">
            <Text variant="monoButton">{'{}'}</Text>
          </IconButton>
          <IconButton accessibilityLabel="Reset map to north">
            <NeedleIcon />
            <Text variant="monoCompass" color="muted" style={{ position: 'absolute', bottom: 8 }}>
              N
            </Text>
          </IconButton>
          <IconButton accessibilityLabel="Show my area">
            <LocateIcon />
          </IconButton>
          <IconButton accessibilityLabel="Location unavailable">
            <LocateIcon color={theme.colors.text.faint} />
          </IconButton>
        </View>

        <SectionLabel>Floating sheet</SectionLabel>
        <FloatingCard style={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: 14 }}>
          <View
            style={{
              minHeight: 36,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 }}>
              <Text variant="label">Busiest now</Text>
              <Text variant="monoMeta" color="muted" numberOfLines={1}>
                Vienna · updated 12s ago
              </Text>
            </View>
            <Text variant="monoTag">Hide</Text>
          </View>
          {[
            ['Stephansplatz', 'sights', 'packed', '~35', 1],
            ['Donaukanal', 'nightlife', 'busy', '~25', 0],
            ['Naschmarkt', 'food', 'moderate', '~20', -1],
          ].map(([title, sub, level, count, trend]) => (
            <View
              key={String(title)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 11,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border.divider,
              }}
            >
              <LevelSwatch level={level as 'busy'} />
              <View style={{ flex: 1 }}>
                <Text variant="callout" numberOfLines={1}>
                  {title}
                </Text>
                <Text variant="monoSub" color="muted" style={{ paddingTop: 2 }}>
                  {sub}
                </Text>
              </View>
              <Text variant="monoData" style={{ minWidth: 34, textAlign: 'right' }}>
                {count}
              </Text>
              <TrendGlyph trend={trend as 1} />
            </View>
          ))}
          <View style={{ paddingTop: 14, paddingBottom: 2 }}>
            <HeatLegend />
          </View>
        </FloatingCard>

        <View style={{ height: 16 }} />
        <FloatingCard
          kind="card"
          style={{ paddingVertical: 20, paddingHorizontal: 18, alignItems: 'center' }}
        >
          <Text variant="headline" style={{ paddingBottom: 6 }}>
            Not enough people here yet
          </Text>
          <Text variant="caption" color="tertiary">
            Cells appear at five people or more.
          </Text>
        </FloatingCard>

        <SectionLabel>Toast</SectionLabel>
        <Button
          label="Show toast"
          variant="quiet"
          size="compact"
          onPress={() => {
            setToast('Sharing off. Your outstanding pings were deleted (2 removed).');
            setTimeout(() => setToast(null), theme.motion.toastDuration);
          }}
        />
      </ScrollView>
      {toast && <Toast message={toast} top={insets.top + 58} />}
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 13,
        backgroundColor: colors.surface.subtle,
      }}
    >
      {children}
    </View>
  );
}

function ColorGroup({ group, colors }: { group: keyof ColorTokens; colors: ColorTokens }) {
  const entries = Object.entries(colors[group] as Record<string, string>);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 6 }}>
      {entries.map(([name, value]) => (
        <View key={name} style={{ width: 82, gap: 4 }}>
          <View
            style={{
              height: 36,
              borderRadius: radius.item,
              backgroundColor: value,
              borderWidth: 1,
              borderColor: colors.border.hairline,
            }}
          />
          <Text variant="monoSub">{name}</Text>
          <Text variant="monoSub" color="muted">
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}
