import * as Haptics from 'expo-haptics';

/**
 * Light, purposeful haptics. Never essential: every action also has a
 * visible and spoken result, and failures are ignored.
 */
export const haptic = {
  /** A switch, chip, tab or option changed. */
  select: () => void Haptics.selectionAsync().catch(() => {}),
  /** A destructive action needs a second tap. */
  warn: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  /** A destructive action completed. */
  success: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};
