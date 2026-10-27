import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink, PolicyFooter, Screen } from '@/components/screen/Screen';
import {
  Button,
  Card,
  GroupedList,
  SectionLabel,
  StatusCard,
  Text,
  Toast,
  ToggleRow,
  type SharingStatus,
} from '@/components/ui';
import {
  POLICY_VERSION,
  resetConsent,
  setLocationSharing,
  useConsent,
} from '@/features/consent/consent';
import {
  acquireCoarseFix,
  permissionState,
  requestPermission,
  type PermissionState,
} from '@/features/location/privacyBoundary';
import {
  addPrivateZone,
  clearPrivateZones,
  isPrivate,
  removePrivateZone,
  usePrivateZones,
} from '@/features/location/privateZones';
import { clearAll } from '@/lib/storage';
import { useTheme, useThemePreference, type ThemePreference } from '@/theme';

/**
 * Settings (design). Status, consent, private areas, rotating ID, delete.
 * The rotating ID and server-side deletion are wired up in Phase 2; until
 * then nothing has ever been sent, and the screen says so.
 */
export default function Settings() {
  const router = useRouter();
  const consent = useConsent();
  const zones = usePrivateZones();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [inPrivateArea, setInPrivateArea] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    permissionState().then(setPermission);
  }, []);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), theme.motion.toastDuration);
  };

  const status: SharingStatus = inPrivateArea
    ? 'paused'
    : consent.location && permission === 'granted'
      ? 'sharing'
      : permission === 'denied'
        ? 'unavailable'
        : 'off';

  const statusCopy: Record<SharingStatus, [string, string]> = {
    sharing: [
      'Sharing on',
      'A cell every 3 min while the app is open. Each one expires after 20 min.',
    ],
    off: ['Sharing off', 'Nothing is sent. Full map access.'],
    paused: ['Paused: private area', 'You marked this area private, so nothing is sent from here.'],
    unavailable: ['Location unavailable', 'Nothing is sent. Full map access.'],
  };

  const toggleSharing = async (on: boolean) => {
    if (on) {
      const state = permission === 'granted' ? permission : await requestPermission();
      setPermission(state);
      setLocationSharing(true);
      if (state !== 'granted')
        say('Location is off for Pulse in system settings, so nothing is sent.');
    } else {
      setLocationSharing(false);
      say('Sharing off. Nothing more will be sent.');
    }
  };

  const markPrivate = async () => {
    try {
      if (permission !== 'granted') {
        const state = await requestPermission();
        setPermission(state);
        if (state !== 'granted') throw new Error('denied');
      }
      const fix = await acquireCoarseFix();
      addPrivateZone(fix.privateKey);
      setInPrivateArea(isPrivate(fix.privateKey));
      say('This area is private now. Nothing will be sent from here.');
    } catch {
      say('Location unavailable, so this area can’t be marked.');
    }
  };

  const deleteData = async () => {
    // Phase 2 adds the server call that deletes the anonymous user and every
    // row linked to it. Locally, everything is wiped and onboarding restarts.
    await clearAll();
    resetConsent();
    clearPrivateZones();
    router.replace('/onboarding');
  };

  const [title, detail] = statusCopy[status];
  const stamp = consent.location ? `on · ${(consent.locationGrantedAt ?? '').slice(0, 10)}` : 'off';

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <BackLink label="Map" onPress={() => router.back()} />
        <Text variant="title" accessibilityRole="header" style={{ marginBottom: 18 }}>
          Settings
        </Text>

        <StatusCard status={status} title={title} detail={detail} />

        <SectionLabel>Consent</SectionLabel>
        <GroupedList>
          <ToggleRow
            label="Share my area"
            stamp={stamp}
            value={consent.location}
            onChange={toggleSharing}
          />
        </GroupedList>

        <SectionLabel>Private areas</SectionLabel>
        <Card>
          <Text variant="footnote" color="secondary">
            {inPrivateArea
              ? 'You are in a private area. Nothing is being sent.'
              : 'Mark where you live or work. It covers about 250 m, small enough that a busy street nearby still counts. The list stays on your phone.'}
          </Text>
          {zones.length > 0 && (
            <View style={{ gap: 6, paddingTop: 12 }}>
              {zones.map((z, i) => (
                <PrivateAreaRow
                  key={z.key}
                  label={`Private area ${i + 1} · ~250 m`}
                  onRemove={() => removePrivateZone(z.key)}
                />
              ))}
            </View>
          )}
        </Card>
        <Button
          label="Never share where I am now"
          variant="quiet"
          size="compact"
          onPress={markPrivate}
          style={{ marginTop: 8 }}
        />

        <AppearanceSection />

        <SectionLabel>Your rotating ID</SectionLabel>
        <Card>
          <Text variant="monoId">No ID yet</Text>
          <Text variant="caption" color="tertiary" style={{ paddingTop: 10 }}>
            A random ID is created the first time you share and replaced every 24 hours. Nothing has
            been sent from this phone.
          </Text>
        </Card>

        <View style={{ gap: 8, paddingTop: 12 }}>
          <Button
            label="Rotate my ID now"
            variant="secondary"
            size="compact"
            onPress={() => say('No ID exists yet, so there is nothing to rotate.')}
          />
          <Button label="Delete my data now" variant="danger" size="compact" onPress={deleteData} />
          <Button
            label="What my phone is sending"
            variant="quiet"
            size="compact"
            onPress={() => router.push('/inspector')}
          />
        </View>

        <PolicyFooter version={POLICY_VERSION} onOpenPolicy={() => router.push('/privacy')} />
        <Text variant="monoFootnote" color="faint" style={{ paddingTop: 6 }}>
          Pulse {Constants.expoConfig?.version ?? ''} · Map data © OpenStreetMap contributors ·
          Tiles OpenFreeMap
        </Text>
      </Screen>
      {toast && <Toast message={toast} top={insets.top + 58} />}
    </View>
  );
}

function PrivateAreaRow({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: colors.surface.base,
        borderWidth: 1,
        borderColor: colors.border.hairline,
        borderRadius: radius.item,
      }}
    >
      <Text variant="callout">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        hitSlop={8}
        onPress={onRemove}
      >
        <Text
          variant="caption"
          color="secondary"
          style={{ paddingVertical: 4, paddingHorizontal: 2 }}
        >
          Remove
        </Text>
      </Pressable>
    </View>
  );
}

/** fill-in: appearance is not in the design. Same grouped-list language as Consent. */
function AppearanceSection() {
  const { colors, size } = useTheme();
  const { preference, setPreference } = useThemePreference();
  const options: { key: ThemePreference; label: string; detail: string }[] = [
    { key: 'system', label: 'Match system', detail: 'Light or dark, following iOS / Android.' },
    { key: 'light', label: 'Light', detail: 'Always light.' },
    { key: 'dark', label: 'Dark', detail: 'Always dark.' },
  ];
  return (
    <>
      <SectionLabel>Appearance</SectionLabel>
      <GroupedList>
        {options.map((o) => {
          const selected = preference === o.key;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={o.label}
              accessibilityHint={o.detail}
              onPress={() => setPreference(o.key)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 15,
                paddingHorizontal: 14,
                minHeight: size.rowMinHeight,
                backgroundColor: pressed ? colors.surface.subtle : colors.surface.base,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text variant="rowTitle" style={{ paddingBottom: 4 }}>
                  {o.label}
                </Text>
                <Text variant="caption" color="tertiary">
                  {o.detail}
                </Text>
              </View>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.border.ink : colors.border.strong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected && (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.text.primary,
                    }}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </GroupedList>
    </>
  );
}
