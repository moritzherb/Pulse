import type { HeatLevel } from '@shared/levels';

/**
 * Pulse design tokens.
 *
 * Every light-mode value below is lifted from design/Pulse.dc.html (the source
 * of truth). Dark-mode values are not in the design; they are derived from the
 * light palette by inverting the neutral scale and keeping the same contrast
 * steps. Anything filled in is marked `// fill-in`.
 */

// ---------------------------------------------------------------- palette ---

/** Raw palette. Components never use these directly; they use `ColorTokens`. */
export const palette = {
  black: '#000000',
  white: '#ffffff',

  // neutrals, exactly as they appear in the design
  ink900: '#000000',
  ink800: '#262626', // primary button pressed
  ink700: '#3d3d3f', // body copy on policy / inspector, sharing pill label
  ink600: '#6b6b6b', // secondary copy
  ink500: '#767678', // tertiary copy, helper lines
  ink400: '#8a8a8c', // mono labels, muted meta
  ink300: '#9a9a9c', // faint meta, idle dot, flat trend
  line300: '#d4d4d6', // strong border, toggle off
  line200: '#e0e0e2', // badge border
  line150: '#e6e6e8', // hairline border, grouped-list gap
  line100: '#ededef', // list divider
  line50: '#f0f0f2', // search-result divider
  fill200: '#f0f0f0', // secondary button pressed
  fill150: '#f2f2f4', // "never sent" pill
  fill120: '#f6f6f6', // tertiary button pressed
  fill100: '#fafafa', // subtle surface
  mapBg: '#f2f2f2', // map container before tiles load
  mapStyleBg: '#f5f5f5', // map style background layer

  green500: '#12b76a', // live / sharing
  red600: '#d92d20', // danger border, compass needle
  red700: '#b42318', // danger text, trend up
  red50: '#fef3f2', // danger pressed
  teal700: '#0b7285', // trend down
} as const;

// ------------------------------------------------------------------ heat ----

/**
 * Continuous heat ramp from the design, used by the blurred heatmap and the
 * legend gradient. `at` is the approximate device count where the colour is
 * reached (design: STOPS in Pulse.dc.html).
 */
export const heatRamp = [
  { at: 0, color: '#3b4cc0' },
  { at: 8, color: '#00b7ff' },
  { at: 16, color: '#3ddc84' },
  { at: 26, color: '#ffd400' },
  { at: 36, color: '#ff8a00' },
  { at: 50, color: '#ff2d1a' },
] as const;

/** Density stops for the MapLibre `heatmap-color` expression (design, verbatim). */
export const heatmapDensityStops = [
  [0, 'rgba(59,76,192,0)'],
  [0.12, '#3b4cc0'],
  [0.32, '#00b7ff'],
  [0.52, '#3ddc84'],
  [0.7, '#ffd400'],
  [0.86, '#ff8a00'],
  [1, '#ff2d1a'],
] as const;

export type { HeatLevel } from '@shared/levels';
export { HEAT_LEVELS as heatLevelOrder } from '@shared/levels';

export type LevelPattern = 'none' | 'dots' | 'lines' | 'cross';

/**
 * Visual treatment of the four named levels. fill-in: the design shows counts
 * on a 6-stop ramp; the brief asks for four labelled levels. Each level takes
 * one colour from the design's ramp and adds a pattern, so a level is never
 * conveyed by colour alone. Thresholds live in supabase/functions/_shared/levels.ts.
 */
export const heatLevels: Record<
  HeatLevel,
  { label: string; color: string; pattern: LevelPattern }
> = {
  quiet: { label: 'Quiet', color: '#00b7ff', pattern: 'none' },
  moderate: { label: 'Moderate', color: '#3ddc84', pattern: 'dots' },
  busy: { label: 'Busy', color: '#ff8a00', pattern: 'lines' },
  packed: { label: 'Packed', color: '#ff2d1a', pattern: 'cross' },
};

// ---------------------------------------------------------- color tokens ----

export type ColorScheme = 'light' | 'dark';

/** Semantic colour roles. Every component reads colours from here. */
export interface ColorTokens {
  text: {
    primary: string;
    body: string;
    secondary: string;
    tertiary: string;
    muted: string;
    faint: string;
    inverse: string;
    danger: string;
  };
  surface: {
    base: string;
    subtle: string;
    sunken: string;
    pressed: string;
    pressedSubtle: string;
    inverse: string;
    inversePressed: string;
    dangerPressed: string;
  };
  border: {
    hairline: string;
    strong: string;
    badge: string;
    divider: string;
    dividerLight: string;
    ink: string;
    danger: string;
  };
  control: {
    trackOn: string;
    trackOff: string;
    knobOn: string;
    knobOff: string;
  };
  status: {
    live: string;
    idle: string;
    paused: string;
  };
  trend: { up: string; down: string; flat: string };
  map: {
    background: string;
    styleBackground: string;
    /** Top fade behind the search bar and chips. */
    topFade: string;
    meDot: string;
    meStroke: string;
    placeStroke: string;
    compassNeedle: string;
  };
  scrim: string;
}

export const lightColors: ColorTokens = {
  text: {
    primary: palette.ink900,
    body: palette.ink700,
    secondary: palette.ink600,
    tertiary: palette.ink500,
    muted: palette.ink400,
    faint: palette.ink300,
    inverse: palette.white,
    danger: palette.red700,
  },
  surface: {
    base: palette.white,
    subtle: palette.fill100,
    sunken: palette.fill150,
    pressed: palette.fill200,
    pressedSubtle: palette.fill120,
    inverse: palette.ink900,
    inversePressed: palette.ink800,
    dangerPressed: palette.red50,
  },
  border: {
    hairline: palette.line150,
    strong: palette.line300,
    badge: palette.line200,
    divider: palette.line100,
    dividerLight: palette.line50,
    ink: palette.ink900,
    danger: palette.red600,
  },
  control: {
    trackOn: palette.ink900,
    trackOff: palette.line300,
    knobOn: palette.white,
    knobOff: palette.white,
  },
  status: { live: palette.green500, idle: palette.ink300, paused: palette.ink400 },
  trend: { up: palette.red700, down: palette.teal700, flat: palette.ink300 },
  map: {
    background: palette.mapBg,
    styleBackground: palette.mapStyleBg,
    topFade: 'linear-gradient(to bottom, rgba(255,255,255,0.92) 30%, rgba(255,255,255,0))',
    meDot: palette.black,
    meStroke: palette.white,
    placeStroke: palette.white,
    compassNeedle: palette.red600,
  },
  scrim: 'rgba(0,0,0,0.32)',
};

/** fill-in: dark mode is not in the design. Neutral scale inverted, same steps. */
export const darkColors: ColorTokens = {
  text: {
    primary: '#f5f5f6',
    body: '#d1d1d4',
    secondary: '#a5a5aa',
    tertiary: '#98989d',
    muted: '#8a8a8f',
    faint: '#6f6f74',
    inverse: '#0b0b0c',
    danger: '#fda29b',
  },
  surface: {
    base: '#0b0b0c',
    subtle: '#141416',
    sunken: '#1c1c1f',
    pressed: '#1f1f22',
    pressedSubtle: '#18181b',
    inverse: '#f5f5f6',
    inversePressed: '#d9d9dc',
    dangerPressed: '#2a1513',
  },
  border: {
    hairline: '#26262a',
    strong: '#3a3a3f',
    badge: '#2e2e33',
    divider: '#222226',
    dividerLight: '#1e1e21',
    ink: '#f5f5f6',
    danger: '#f97066',
  },
  control: {
    trackOn: '#f5f5f6',
    trackOff: '#3a3a3f',
    // Inverted track needs a dark knob to stay visible.
    knobOn: '#0b0b0c',
    knobOff: '#f5f5f6',
  },
  status: { live: '#32d583', idle: '#6f6f74', paused: '#8a8a8f' },
  trend: { up: '#f97066', down: '#3cc6d6', flat: '#6f6f74' },
  map: {
    background: '#141416',
    styleBackground: '#111113',
    topFade: 'linear-gradient(to bottom, rgba(11,11,12,0.92) 30%, rgba(11,11,12,0))',
    meDot: '#f5f5f6',
    meStroke: '#0b0b0c',
    placeStroke: '#0b0b0c',
    compassNeedle: '#f97066',
  },
  scrim: 'rgba(0,0,0,0.56)',
};

/**
 * fill-in: stronger neutrals when the person turns on Increase Contrast (iOS)
 * or High contrast text (Android). The design's muted greys (#8a8a8c on white,
 * 3.5:1) are below WCAG AA for its 10 pt mono labels; these reach at least
 * 4.5:1 while keeping the same hierarchy.
 */
export const lightHighContrast: ColorTokens = {
  ...lightColors,
  text: {
    ...lightColors.text,
    secondary: '#555557',
    tertiary: '#5c5c5f',
    muted: '#68686b',
    faint: '#707073',
  },
  border: { ...lightColors.border, hairline: '#c9c9cc', strong: '#9e9ea1', divider: '#d6d6d9' },
  control: { ...lightColors.control, trackOff: '#9e9ea1' },
};

export const darkHighContrast: ColorTokens = {
  ...darkColors,
  text: {
    ...darkColors.text,
    secondary: '#c4c4c8',
    tertiary: '#b8b8bd',
    muted: '#ababb0',
    faint: '#939398',
  },
  border: { ...darkColors.border, hairline: '#3c3c42', strong: '#5c5c63', divider: '#34343a' },
  control: { ...darkColors.control, trackOff: '#5c5c63' },
};

// ---------------------------------------------------------------- spacing ---

/**
 * Spacing values used by the design. Keyed by their pixel value so a padding
 * of 14 in the HTML reads as `space[14]` in code, which makes it trivial to
 * check a component against the source.
 */
export const space = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
  16: 16,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  26: 26,
  30: 30,
} as const;

/** Layout constants from the design's 402 x 874 iPhone frame. */
export const layout = {
  /** Horizontal padding of full-page screens (consent, settings, privacy). */
  screenPaddingX: 22,
  /** Map overlays sit 14 from the screen edges. */
  mapGutter: 14,
  /**
   * The design frame places content 54 px from the top of the screen, just
   * under the status bar. On device that is the safe-area top inset; these
   * are the extra offsets beyond it.
   */
  screenTopExtra: { settings: 0, consent: 6, map: 0 },
  /** Design bottom padding (44) minus the frame's 34 px home-indicator area. */
  screenBottomExtra: 10,
  /** The floating "Busiest now" card sits 30 from the bottom (34 px indicator - 4). */
  sheetBottomOffset: -4,
  /** Floating map controls start 168 from the top (54 safe area + 114). */
  mapControlsTop: 114,
} as const;

// ------------------------------------------------------------------ sizes ---

export const size = {
  control: 44, // round map buttons, chips, search field
  button: 52, // primary / secondary consent buttons
  buttonCompact: 48, // settings buttons
  rowMinHeight: 46, // tappable list rows
  sheetHeaderMinHeight: 36,
  toggle: { width: 46, height: 28, padding: 3, knob: 22 },
  swatch: 10,
  statusDot: 7,
  liveDot: 6,
  legendBar: 6,
  iconRing: 13, // search + settings ring glyphs
  locateRing: 15,
  locateDot: 4,
  compassFace: 26,
} as const;

// ------------------------------------------------------------------ radii ---

export const radius = {
  swatch: 3,
  item: 6, // private-area rows
  card: 8, // grouped lists, buttons, cards
  toast: 10, // toast, empty-state card
  popover: 12, // search results
  sheet: 14, // floating "Busiest now" card
  modal: 16, // bottom modal top corners
  pill: 999,
} as const;

// ---------------------------------------------------------------- shadows ---

/**
 * CSS box-shadow strings, verbatim from the design. React Native 0.76+ renders
 * `boxShadow` natively on iOS and Android, so these are exact, not approximated.
 */
export const shadows = {
  /** Round map buttons and the search field. */
  control: '0px 1px 5px rgba(0,0,0,0.12)',
  /** Filter chips and the sharing pill. */
  chip: '0px 1px 4px rgba(0,0,0,0.10)',
  /** Toggle knob. */
  knob: '0px 1px 3px rgba(0,0,0,0.28)',
  /** Empty-state card. */
  card: '0px 6px 20px rgba(0,0,0,0.12)',
  /** Search results popover. */
  popover: '0px 6px 22px rgba(0,0,0,0.16)',
  /** Floating "Busiest now" card. */
  sheet: '0px 6px 24px rgba(0,0,0,0.18)',
  /** Toast. */
  toast: '0px 6px 20px rgba(0,0,0,0.28)',
} as const;

export type ShadowToken = keyof typeof shadows;

/** fill-in: in dark mode shadows barely read, so floating surfaces also get a hairline. */
export const darkShadows: Record<ShadowToken, string> = {
  control: '0px 1px 5px rgba(0,0,0,0.6)',
  chip: '0px 1px 4px rgba(0,0,0,0.5)',
  knob: '0px 1px 3px rgba(0,0,0,0.5)',
  card: '0px 6px 20px rgba(0,0,0,0.5)',
  popover: '0px 6px 22px rgba(0,0,0,0.55)',
  sheet: '0px 6px 24px rgba(0,0,0,0.6)',
  toast: '0px 6px 20px rgba(0,0,0,0.6)',
};

// ----------------------------------------------------------------- motion ---

export const motion = {
  /** Toggle track colour + knob travel (design: `transition: background 160ms`). */
  toggle: 160,
  /** Sharing dot (design: `pulseDot 2.4s ease-in-out infinite`, opacity 1 -> 0.15). */
  liveDotPeriod: 2400,
  liveDotMinOpacity: 0.15,
  /** Camera moves: fly to a place, locate me, pick city (design: easeTo 900 ms). */
  camera: 900,
  /** Reset north (design: easeTo 400 ms). */
  resetNorth: 400,
  /** Toast visible time (design: 4600 ms). */
  toastDuration: 4600,
  // fill-in: the design has no explicit values for these.
  /** Colour change when a place changes level. */
  levelChange: 600,
  /** One full breath of the heatmap over Busy / Packed places. */
  placePulsePeriod: 2400,
  /** Press feedback on buttons and rows. */
  press: 120,
} as const;

// -------------------------------------------------------------- z-order -----

export const zIndex = {
  map: 0,
  mapChrome: 10,
  sheet: 20,
  popover: 30,
  modal: 40,
  toast: 50,
} as const;
