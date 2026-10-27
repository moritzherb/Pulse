import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { Text } from './Text';

export interface ToastProps {
  message: string;
  /** Distance from the top of the screen. The design uses 112. */
  top: number;
}

/**
 * Black confirmation banner ("Deleted (3 removed).") Also announced to
 * VoiceOver / TalkBack, since it is the only feedback for some actions.
 */
export function Toast({ message, top }: ToastProps) {
  const { colors, radius, shadows, layout, zIndex } = useTheme();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.duration(220)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(180)}
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top,
        left: layout.mapGutter,
        right: layout.mapGutter,
        paddingVertical: 13,
        paddingHorizontal: 15,
        borderRadius: radius.toast,
        backgroundColor: colors.surface.inverse,
        boxShadow: shadows.toast,
        zIndex: zIndex.toast,
      }}
    >
      <Text variant="calloutLong" color="inverse">
        {message}
      </Text>
    </Animated.View>
  );
}
