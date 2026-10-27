import { useEffect, type ReactNode } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

export interface BreatheProps {
  children: ReactNode;
  active: boolean;
  /** Lowest opacity of the cycle. The design's live dot uses 0.15. */
  min?: number;
}

/**
 * The design's breathing rhythm (pulseDot: opacity 1 -> min -> 1, 2.4 s,
 * ease-in-out) for any element, e.g. the locate button while it searches.
 * Static under Reduce Motion.
 */
export function Breathe({ children, active, min }: BreatheProps) {
  const { motion } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const floor = min ?? motion.liveDotMinOpacity;

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: motion.press });
      return;
    }
    opacity.value = withRepeat(
      withTiming(floor, { duration: motion.liveDotPeriod / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [active, reduceMotion, floor, opacity, motion.liveDotPeriod, motion.press]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
