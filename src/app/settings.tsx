import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
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
import { haptic } from '@/lib/haptics';
import { clearAll } from '@/lib/storage';
import { useSimulatedFeed } from '@/features/density/useDensity';
import { useTheme, useThemePreference, type ThemePreference } from '@/theme';

const STATUS_COPY: Record<SharingStatus, { card: CardStatus; title: string; detail: string }> = {
  sharing: {
    card: 'sharing',
    title: 'Sharing on',
    detail:
      'The place you are at, every 3 min while the app is open. Each report expires within 20 min.',
  },
  arriving: {
    card: 'sharing',
    title: 'Sharing on',
    detail: 'You count once you have stayed 2 minutes, so walking past a place does not.',
  },
  away: {
    card: 'paused',
    title: 'Sharing on, nothing to send',
    detail: 'You are not at a place on the map right now, so nothing is sent.',
  },
  preparing: {
    card: 'paused',
    title: 'Sharing on, getting ready',
    detail:
      'Pulse is loading the places of this area for the first time. This takes a minute or two; nothing is sent until then.',
  },
  imprecise: {
    card: 'paused',
    title: 'Sharing on, location too rough',
    detail:
      'Pulse cannot tell which place you are at, so nothing is sent. Turn on Precise Location for Pulse in system settings.',
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
  const simulated = useSimulatedFeed();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshOutstanding();
  }, []);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = (m: string) => {
    clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = setTimeout(() => setToast(null), theme.motion.toastDuration);
  };

  // fill-in: "Delete my data now" asks for a second tap within 5 s, so a stray
  // tap cannot wipe the identity. The design shows a single button.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(confirmTimer.current);
    },
    [],
  );
  const onDeletePress = () => {
    if (!confirmingDelete) {
      haptic.warn();
      setConfirmingDelete(true);
      AccessibilityInfo.announceForAccessibility('Tap again to delete everything.');
      confirmTimer.current = setTimeout(() => setConfirmingDelete(false), 5000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmingDelete(false);
    deleteData();
  };

  const status = consent.location ? sharing.status : 'off';
  const copy = STATUS_COPY[status];
  const outstandingCopy =
    status === 'sharing' && sharing.outstanding > 0
      ? `${sharing.myPlace ? `At ${sharing.myPlace.name}. ` : ''}${sharing.outstanding} report(s) stored, all expiring within 20 min.`
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
      if (consent.location) sendPing(); // re-evaluates: now paused
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
    haptic.success();
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
              : 'Homes and offices are never places on the map, so they are never sent. For extra peace of mind, mark where you live or work: nothing is sent within about 250 m. The list stays on your phone.'}
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
            label={confirmingDelete ? 'Tap again to delete everything' : 'Delete my data now'}
            variant="danger"
            size="compact"
            disabled={busy}
            onPress={onDeletePress}
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
        {__DEV__ && (
          // Design: "Simulated feed on." under the policy line (development builds only).
          <Text variant="monoFootnote" color="faint" style={{ paddingTop: 6 }}>
            Simulated feed {simulated ? 'on' : 'off'}.
          </Text>
        )}
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
              onPress={() => {
                haptic.select();
                setPreference(o.key);
              }}
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
