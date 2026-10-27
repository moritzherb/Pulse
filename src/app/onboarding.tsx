import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { PolicyFooter, Screen } from '@/components/screen/Screen';
import { Button, GroupedList, Text } from '@/components/ui';
import { decide, POLICY_VERSION } from '@/features/consent/consent';
import { requestPermission } from '@/features/location/privacyBoundary';
import { useTheme } from '@/theme';

/**
 * Consent (design variant A). Plain language, nothing sent before a choice.
 * Both buttons open the same map; only "Share anonymously" asks iOS/Android
 * for location, and only after it is tapped.
 */
const FACTS = [
  { k: 'Sent', v: 'A 460 m area, while the app is open.' },
  {
    k: 'Never sent',
    v: 'Your address, name, or phone. Areas with fewer than five people are never shown, so your home can’t appear on its own.',
  },
  { k: 'Kept', v: '20 minutes.' },
  { k: 'Withdraw', v: 'One tap. Deletes what exists.' },
];

export default function Onboarding() {
  const router = useRouter();
  const { colors, layout } = useTheme();

  const share = async () => {
    decide(true);
    // The system prompt appears only now, after an explicit choice.
    await requestPermission();
    router.replace('/');
  };

  const browse = () => {
    decide(false);
    router.replace('/');
  };

  return (
    <Screen topExtra={layout.screenTopExtra.consent}>
      <Rise step={0}>
        <Text variant="display" accessibilityRole="header" style={{ marginBottom: 12 }}>
          Before the map
        </Text>
      </Rise>
      <Rise step={1}>
        <Text variant="lead" color="secondary" style={{ marginBottom: 24 }}>
          See how busy places are, live. Looking costs nothing.
        </Text>
      </Rise>

      <Rise step={2}>
        <GroupedList>
          {FACTS.map((f) => (
            <View
              key={f.k}
              accessible
              accessibilityLabel={`${f.k}: ${f.v}`}
              style={{
                backgroundColor: colors.surface.subtle,
                paddingVertical: 13,
                paddingHorizontal: 14,
              }}
            >
              <Text variant="monoSection" color="muted" style={{ paddingBottom: 5 }}>
                {f.k}
              </Text>
              <Text variant="body">{f.v}</Text>
            </View>
          ))}
        </GroupedList>
      </Rise>

      <Rise step={3}>
        <View style={{ gap: 10, paddingTop: 26 }}>
          <Button label="Share anonymously" variant="primary" onPress={share} />
          <Button label="Just browse" variant="secondary" onPress={browse} />
        </View>
        <Text variant="footnote" color="tertiary" style={{ paddingTop: 14 }}>
          Both open the same map.
        </Text>
        <PolicyFooter version={POLICY_VERSION} onOpenPolicy={() => router.push('/privacy')} />
      </Rise>
    </Screen>
  );
}

/**
 * fill-in: a quiet entrance. Blocks rise 8 pt and fade in, 70 ms apart, the
 * first time the screen appears. Nothing moves under Reduce Motion.
 */
function Rise({ step, children }: { step: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(420)
              .delay(80 + step * 70)
              .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
      }
    >
      {children}
    </Animated.View>
  );
}
