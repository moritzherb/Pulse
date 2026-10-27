import { useRouter } from 'expo-router';
import { View } from 'react-native';

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
      <Text variant="display" accessibilityRole="header" style={{ marginBottom: 12 }}>
        Before the map
      </Text>
      <Text variant="lead" color="secondary" style={{ marginBottom: 24 }}>
        See how busy places are, live. Looking costs nothing.
      </Text>

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

      <View style={{ gap: 10, paddingTop: 26 }}>
        <Button label="Share anonymously" variant="primary" onPress={share} />
        <Button label="Just browse" variant="secondary" onPress={browse} />
      </View>
      <Text variant="footnote" color="tertiary" style={{ paddingTop: 14 }}>
        Both open the same map.
      </Text>
      <PolicyFooter version={POLICY_VERSION} onOpenPolicy={() => router.push('/privacy')} />
    </Screen>
  );
}
