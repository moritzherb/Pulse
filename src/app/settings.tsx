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
  type SharingStatus as CardStatus,
} from '@/components/ui';
import {
  POLICY_VERSION,
  resetConsent,
  setLocationSharing,
  useConsent,
} from '@/features/consent/consent';
import {
  deleteIdentity,
  ROTATE_AFTER_MS,
  rotateIdentity,
  useIdentity,
} from '@/features/identity/identity';
import {
  acquireCoarseFix,
  permissionState,
  requestPermission,
} from '@/features/location/privacyBoundary';
import {
  addPrivateZone,
  clearPrivateZones,
  removePrivateZone,
  usePrivateZones,
} from '@/features/location/privateZones';
import {
  deleteSentPings,
  refreshOutstanding,
  resetSharing,
  sendPing,
  useSharing,
  withdraw,
  type SharingStatus,
} from '@/features/sharing/sharing';
import { clearAll } from '@/lib/storage';
import { useTheme, useThemePreference, type ThemePreference } from '@/theme';

const STATUS_COPY: Record<SharingStatus, { card: CardStatus; title: string; detail: string }> = {
  sharing: {
    card: 'sharing',
    title: 'Sharing on',
    detail: 'A cell every 3 min while the app is open. Each one expires within 20 min.',
  },
  off: { card: 'off', title: 'Sharing off', detail: 'Nothing is sent. Full map access.' },
  paused: {
    card: 'paused',
    title: 'Paused: private area',
    detail: 'You marked this area private, so nothing is sent from here.',
  },
  unavailable: {
    card: 'unavailable',
    title: 'Location unavailable',
    detail: 'Location is off for Pulse in system settings. Nothing is sent.',
  },
  offline: {
    card: 'unavailable',
    title: 'Sharing on, not connected',
    detail: 'The server could not be reached. Pulse tries again every 3 min.',
  },
};

/** Settings (design): status, consent, private areas, appearance, rotating ID, delete. */
export default function Settings() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const consent = useConsent();
  const sharing = useSharing();
  const identity = useIdentity();
  const zones = usePrivateZones();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshOutstanding();
  }, []);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), theme.motion.toastDuration);
  };

  const status = consent.location ? sharing.status : 'off';
  const copy = STATUS_COPY[status];
  const outstandingCopy =
    status === 'sharing' && sharing.outstanding > 0
      ? `A cell every 3 min. ${sharing.outstanding} row(s), all expiring within 20 min.`
      : copy.detail;

  const toggleSharing = async (on: boolean) => {
    if (on) {
      const state = (await permissionState()) === 'granted' ? 'granted' : await requestPermission();
      setLocationSharing(true);
      if (state !== 'granted')
        say('Location is off for Pulse in system settings, so nothing is sent.');
      return;
    }
    setLocationSharing(false);
    try {
      const n = await withdraw();
      say(`Sharing off. Your outstanding pings were deleted${n ? ` (${n} removed)` : ''}.`);
    } catch {
      say('Sharing off. Deleting sent pings failed; they expire within 20 minutes anyway.');
    }
  };

  const markPrivate = async () => {
    try {
      if ((await permissionState()) !== 'granted' && (await requestPermission()) !== 'granted') {
        throw new Error('denied');
      }
      const fix = await acquireCoarseFix();
      addPrivateZone(fix.privateKey);
      const removed = await deleteSentPings().catch(() => 0);
      if (consent.location) sendPing(fix); // re-evaluates: now paused
      say(
        `This area is private now. Nothing will be sent from here${
          removed ? `, and ${removed} earlier report(s) were deleted` : ''
        }.`,
      );
    } catch {
      say('Location unavailable, so this area can’t be marked.');
    }
  };

  const rotate = async () => {
    if (!identity.userId) {
      say('No ID exists yet, so there is nothing to rotate.');
      return;
    }
    try {
      setBusy(true);
      await rotateIdentity();
      await refreshOutstanding();
      say('New ID issued. Nothing sent before is linked to it.');
    } catch {
      say('Couldn’t reach the server. Your ID was not changed.');
    } finally {
      setBusy(false);
    }
  };

  const deleteData = async () => {
    try {
      setBusy(true);
      // Server first: if it fails, nothing local is wiped and you can retry.
      await deleteIdentity();
    } catch {
      setBusy(false);
      say('Couldn’t reach the server, so nothing was deleted yet. Try again when online.');
      return;
    }
    resetSharing();
    clearPrivateZones();
    await clearAll();
    resetConsent();
    router.replace('/onboarding');
  };

  const stamp = consent.location ? `on · ${(consent.locationGrantedAt ?? '').slice(0, 10)}` : 'off';
  const rotatesOn = identity.createdAt
    ? new Date(new Date(identity.createdAt).getTime() + ROTATE_AFTER_MS).toISOString().slice(0, 10)
    : null;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <BackLink label="Map" onPress={() => router.back()} />
        <Text variant="title" accessibilityRole="header" style={{ marginBottom: 18 }}>
          Settings
        </Text>

        <StatusCard status={copy.card} title={copy.title} detail={outstandingCopy} />

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
            {status === 'paused'
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
          <Text variant="monoId" selectable>
            {identity.userId ?? 'No ID yet'}
          </Text>
          {rotatesOn && (
            <Text variant="monoSub" color="muted" style={{ paddingTop: 6 }}>
              rotates {rotatesOn}
            </Text>
          )}
          <Text variant="caption" color="tertiary" style={{ paddingTop: 10 }}>
            {identity.userId
              ? `${sharing.outstanding} row(s) linked to this ID.`
              : 'A random ID is created the first time you share and replaced every 24 hours. Nothing has been sent from this phone.'}
          </Text>
        </Card>

        <View style={{ gap: 8, paddingTop: 12 }}>
          <Button
            label="Rotate my ID now"
            variant="secondary"
            size="compact"
            disabled={busy}
            onPress={rotate}
          />
          <Button
            label="Delete my data now"
            variant="danger"
            size="compact"
            disabled={busy}
            onPress={deleteData}
          />
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
