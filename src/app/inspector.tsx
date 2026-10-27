import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupedList, StrikePill, Text } from '@/components/ui';
import { useConsent } from '@/features/consent/consent';
import { useTheme } from '@/theme';

const NEVER_SENT = ['your address', 'your name', 'your phone', 'any history'];

/**
 * "What's sent" (design inspector). A bottom sheet over a scrim. Phase 2
 * fills "Your area" and "Last update" from the live ping pipeline.
 */
export default function Inspector() {
  const router = useRouter();
  const consent = useConsent();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const summary = consent.location
    ? 'Your phone says “someone is in this 460 m area”, nothing else. It is forgotten after 20 minutes.'
    : 'Nothing is being sent right now. You are only looking.';

  const rows = [
    { k: 'Your area', v: consent.location ? 'a 460 m area' : 'not shared' },
    { k: 'Last update', v: 'never' },
    { k: 'Kept for', v: '20 minutes' },
  ];

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(160)}
      style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ flex: 1 }}
        onPress={() => router.back()}
      />
      <Animated.View
        entering={reduceMotion ? undefined : SlideInDown.duration(260)}
        accessibilityViewIsModal
        style={{
          maxHeight: '90%',
          borderTopLeftRadius: radius.modal,
          borderTopRightRadius: radius.modal,
          backgroundColor: colors.surface.base,
        }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 26 + insets.bottom,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingBottom: 14,
            }}
          >
            <Text variant="label" accessibilityRole="header">
              What’s sent
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={{ padding: 6 }}
            >
              <Text variant="monoAction">Close</Text>
            </Pressable>
          </View>
          <Text variant="summary" color="body" style={{ paddingBottom: 16 }}>
            {summary}
          </Text>
          <GroupedList>
            {rows.map((r) => (
              <View
                key={r.k}
                accessible
                accessibilityLabel={`${r.k}: ${r.v}`}
                style={{
                  backgroundColor: colors.surface.subtle,
                  paddingVertical: 12,
                  paddingHorizontal: 13,
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'baseline',
                }}
              >
                <Text variant="callout" style={{ flex: 1 }}>
                  {r.k}
                </Text>
                <Text variant="callout" color="secondary" align="right">
                  {r.v}
                </Text>
              </View>
            ))}
          </GroupedList>
          <Text variant="callout" color="secondary" style={{ paddingTop: 16, paddingBottom: 8 }}>
            Never leaves your phone
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {NEVER_SENT.map((n) => (
              <StrikePill key={n} label={n} />
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}
