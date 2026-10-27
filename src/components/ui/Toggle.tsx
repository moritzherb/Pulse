import { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

export interface ToggleProps {
  value: boolean;
}

/**
 * The design's switch: 46 x 28 track, 22 pt knob, 3 pt inset, 160 ms.
 * Purely visual: the whole row it sits in is the tap target and carries the
 * `switch` accessibility role (see ToggleRow).
 */
export function Toggle({ value }: ToggleProps) {
  const { colors, size, shadows, motion } = useTheme();
  const { width, height, padding, knob } = size.toggle;
  const travel = width - padding * 2 - knob;
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: motion.toggle });
  }, [value, progress, motion.toggle]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.control.trackOff, colors.control.trackOn],
    ),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travel }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.control.knobOff, colors.control.knobOn],
    ),
  }));

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: height / 2, padding, justifyContent: 'center' },
        trackStyle,
      ]}
    >
      <Animated.View
        style={[
          { width: knob, height: knob, borderRadius: knob / 2, boxShadow: shadows.knob },
          knobStyle,
        ]}
      />
    </Animated.View>
  );
}
