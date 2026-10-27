import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Card } from './Card';
import { LiveDot } from './LiveDot';
import { Text } from './Text';

export type SharingStatus = 'sharing' | 'off' | 'paused' | 'unavailable';

export interface StatusCardProps {
  status: SharingStatus;
  title: string;
  detail: string;
}

/** Settings header card: status dot, title, one-line explanation. */
export function StatusCard({ status, title, detail }: StatusCardProps) {
  const { colors, size } = useTheme();
  const dot =
    status === 'sharing'
      ? colors.status.live
      : status === 'paused'
        ? colors.status.paused
        : colors.status.idle;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={{ marginTop: 6 }}>
        <LiveDot color={dot} size={size.statusDot} active={status === 'sharing'} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }} accessible accessibilityLabel={`${title}. ${detail}`}>
        <Text variant="rowTitle">{title}</Text>
        <Text variant="caption" color="tertiary" style={{ paddingTop: 3 }}>
          {detail}
        </Text>
      </View>
    </Card>
  );
}
