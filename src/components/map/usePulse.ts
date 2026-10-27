import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Drives the "breathing" of busy cells. JS only flips a boolean every half
 * period; MapLibre animates between the two paint values natively with a
 * paint transition, so there is no per-frame bridge traffic.
 *
 * Stops while the app is in the background and when the OS asks for
 * reduced motion.
 */
export function usePulse(periodMs: number, enabled = true): { on: boolean; animate: boolean } {
  const reduceMotion = useReducedMotion();
  const [on, setOn] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const animate = enabled && active && !reduceMotion;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setOn((v) => !v), periodMs / 2);
    return () => clearInterval(id);
  }, [animate, periodMs]);

  // When not animating, rest in the "off" state.
  return { on: animate && on, animate };
}
