import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

export interface LiveDotProps {
  color?: string;
  size?: number;
  /** Pulse while true. Static when false or when the OS asks for reduced motion. */
  active?: boolean;
}

/**
 * The design's breathing status dot: opacity 1 -> 0.15 -> 1 over 2.4 s,
 * ease-in-out, forever (`@keyframes pulseDot`).
 */
export function LiveDot({ color, size, active = true }: LiveDotProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const d = size ?? theme.size.liveDot;

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withTiming(theme.motion.liveDotMinOpacity, {
        duration: theme.motion.liveDotPeriod / 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [active, reduceMotion, opacity, theme.motion.liveDotMinOpacity, theme.motion.liveDotPeriod]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: color ?? theme.colors.status.live,
        },
        style,
      ]}
    />
  );
}
