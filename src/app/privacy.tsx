import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { BackLink, Screen } from '@/components/screen/Screen';
import { Text } from '@/components/ui';
import { POLICY_VERSION } from '@/features/consent/consent';
import { POLICY_SECTIONS } from '@/features/privacy/policy';

/** Privacy policy (design). Reachable from consent and settings. */
export default function Privacy() {
  const router = useRouter();
  return (
    <Screen>
      <BackLink
        label="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <Text variant="title" accessibilityRole="header" style={{ marginBottom: 4 }}>
        Privacy
      </Text>
      <Text variant="monoFootnote" color="muted" style={{ paddingBottom: 20 }}>
        Version {POLICY_VERSION}
      </Text>
      <View style={{ gap: 20 }}>
        {POLICY_SECTIONS.map((s) => (
          <View key={s.h}>
            <Text
              variant="monoSection"
              color="muted"
              accessibilityRole="header"
              style={{ paddingBottom: 7 }}
            >
              {s.h}
            </Text>
            <Text variant="bodyLong" color="body">
              {s.p}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
