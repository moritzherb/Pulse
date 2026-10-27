import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { readJson, StorageKeys, writeJson } from '@/lib/storage';

import {
  darkColors,
  darkShadows,
  layout,
  lightColors,
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

function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
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

const lightTheme = buildTheme('light');
const darkTheme = buildTheme('dark');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
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

  const value = useMemo(
    () => ({ theme: scheme === 'dark' ? darkTheme : lightTheme, preference, setPreference }),
    [scheme, preference, setPreference],
  );

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
