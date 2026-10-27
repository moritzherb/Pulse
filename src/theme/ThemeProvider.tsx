import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Appearance, Platform, useColorScheme } from 'react-native';

import { readJson, StorageKeys, writeJson } from '@/lib/storage';

import {
  darkColors,
  darkHighContrast,
  darkShadows,
  layout,
  lightColors,
  lightHighContrast,
  motion,
  radius,
  shadows,
  size,
  space,
  zIndex,
  type ColorScheme,
  type ColorTokens,
  type ShadowToken,
} from './tokens';
import { type } from './typography';

/** What the user picked in Settings. "system" follows the OS appearance. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  colors: ColorTokens;
  shadows: Record<ShadowToken, string>;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  layout: typeof layout;
  motion: typeof motion;
  zIndex: typeof zIndex;
}

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTheme(scheme: ColorScheme, highContrast: boolean): Theme {
  const colors =
    scheme === 'dark'
      ? highContrast
        ? darkHighContrast
        : darkColors
      : highContrast
        ? lightHighContrast
        : lightColors;
  return {
    scheme,
    colors,
    shadows: scheme === 'dark' ? darkShadows : shadows,
    type,
    space,
    radius,
    size,
    layout,
    motion,
    zIndex,
  };
}

const themes = {
  light: buildTheme('light', false),
  dark: buildTheme('dark', false),
  lightHC: buildTheme('light', true),
  darkHC: buildTheme('dark', true),
};

/** iOS "Increase Contrast" / Android "High contrast text". */
function useHighContrast(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const read = ios
      ? AccessibilityInfo.isDarkerSystemColorsEnabled()
      : AccessibilityInfo.isHighTextContrastEnabled();
    read.then(setOn).catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      ios ? 'darkerSystemColorsChanged' : 'highTextContrastChanged',
      setOn,
    );
    return () => sub.remove();
  }, []);
  return on;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const highContrast = useHighContrast();
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = readJson<ThemePreference>(StorageKeys.themePreference, 'system');
    // Apply a stored override before first paint so there is no flash.
    if (stored !== 'system') Appearance.setColorScheme(stored);
    return stored;
  });

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeJson(StorageKeys.themePreference, next);
    // Keeps native UI (alerts, keyboard, location prompt) in step with the app.
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(() => {
    const key = `${scheme}${highContrast ? 'HC' : ''}` as keyof typeof themes;
    return { theme: themes[key], preference, setPreference };
  }, [scheme, highContrast, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Current theme tokens. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx.theme;
}

/** Theme preference and setter, for the Settings screen. */
export function useThemePreference() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference must be used inside <ThemeProvider>');
  return { preference: ctx.preference, setPreference: ctx.setPreference };
}
