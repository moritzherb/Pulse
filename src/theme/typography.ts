import { Platform, type TextStyle } from 'react-native';

/**
 * Typography, extracted from design/Pulse.dc.html.
 *
 * The design uses two families:
 *   - 'Helvetica Neue' for all interface text (weights 400 and 500)
 *   - 'IBM Plex Mono' for labels, data, IDs and payloads (400 and 500)
 *
 * Helvetica Neue ships with iOS. It cannot be bundled on Android (commercial
 * licence), so Android uses Arimo, which is metric-compatible with Helvetica /
 * Arial: line breaks and widths match the design.
 *
 * CSS `letter-spacing` in em is converted to points here (em x font size).
 */

/** Font assets loaded at startup (see src/theme/fonts.ts). */
export const fontFamilies = {
  sans: Platform.select({ ios: 'HelveticaNeue', default: 'Arimo_400Regular' }),
  sansMedium: Platform.select({ ios: 'HelveticaNeue-Medium', default: 'Arimo_500Medium' }),
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

/** One step of the type scale. */
export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform?: TextStyle['textTransform'];
  /**
   * Cap for Dynamic Type / Android font scale. Reading text scales freely;
   * text inside fixed-shape controls is capped so controls stay usable.
   */
  maxScale: number;
}

const em = (value: number, fontSize: number) => Math.round(value * fontSize * 100) / 100;

const sans = (
  fontSize: number,
  lineHeightRatio: number,
  opts: { medium?: boolean; tracking?: number; maxScale?: number } = {},
): TypeStyle => ({
  fontFamily: opts.medium ? fontFamilies.sansMedium : fontFamilies.sans,
  fontSize,
  lineHeight: Math.round(fontSize * lineHeightRatio * 10) / 10,
  letterSpacing: em(opts.tracking ?? 0, fontSize),
  maxScale: opts.maxScale ?? 2,
});

const mono = (
  fontSize: number,
  lineHeightRatio: number,
  opts: { tracking?: number; upper?: boolean; maxScale?: number } = {},
): TypeStyle => ({
  fontFamily: fontFamilies.mono,
  fontSize,
  lineHeight: Math.round(fontSize * lineHeightRatio * 10) / 10,
  letterSpacing: em(opts.tracking ?? 0, fontSize),
  ...(opts.upper ? { textTransform: 'uppercase' as const } : {}),
  maxScale: opts.maxScale ?? 1.6,
});

/** Browsers render `line-height: normal` at roughly 1.2 for these faces. */
const NORMAL = 1.2;

export const type = {
  // --- sans -----------------------------------------------------------------
  /** Consent headline. 31 / 1.1 / 500 / -0.03em */
  display: sans(31, 1.1, { medium: true, tracking: -0.03, maxScale: 1.6 }),
  /** Settings / Privacy page title. 27 / 500 / -0.028em */
  title: sans(27, NORMAL, { medium: true, tracking: -0.028, maxScale: 1.6 }),
  /** Empty-state title. 17 / -0.02em */
  headline: sans(17, NORMAL, { tracking: -0.02, maxScale: 1.8 }),
  /** Primary + secondary buttons. 16 */
  button: sans(16, NORMAL, { maxScale: 1.35 }),
  /** Settings buttons. 15 */
  buttonCompact: sans(15, NORMAL, { maxScale: 1.35 }),
  /** Intro paragraph under a headline. 15 / 1.5 */
  lead: sans(15, 1.5),
  /** Toggle row title, status title. 14.5 */
  rowTitle: sans(14.5, NORMAL),
  /** Inspector plain-language summary. 14.5 / 1.55 */
  summary: sans(14.5, 1.55),
  /** Fact values, short body. 14 / 1.5 */
  body: sans(14, 1.5),
  /** Privacy policy paragraphs. 14 / 1.6 */
  bodyLong: sans(14, 1.6),
  /** Sheet header, back link, search input. 14 */
  label: sans(14, NORMAL, { maxScale: 1.5 }),
  /** Chips, list titles, inspector rows. 13.5 */
  callout: sans(13.5, NORMAL, { maxScale: 1.5 }),
  /** Toast. 13.5 / 1.5 */
  calloutLong: sans(13.5, 1.5),
  /** Helper lines, private-area note. 13 / 1.5 */
  footnote: sans(13, 1.5),
  /** Toggle row detail, status detail. 12.5 / 1.45 */
  caption: sans(12.5, 1.45),
  /** Search result country. 11.5 */
  small: sans(11.5, NORMAL),

  // --- mono -----------------------------------------------------------------
  /** Section labels: "CONSENT", "PRIVATE AREAS". 10 / 0.14em / upper */
  monoSection: mono(10, NORMAL, { tracking: 0.14, upper: true }),
  /** "EACH ONE SEPARATE". 10 / 0.16em / upper */
  monoSectionWide: mono(10, NORMAL, { tracking: 0.16, upper: true }),
  /** Inline actions: SHOW / HIDE / CLOSE. 10 / 0.12em / upper */
  monoAction: mono(10, NORMAL, { tracking: 0.12, upper: true, maxScale: 1.35 }),
  /** Sharing pill, sheet toggle. 10 / 0.1em / upper */
  monoTag: mono(10, NORMAL, { tracking: 0.1, upper: true, maxScale: 1.35 }),
  /** Sheet meta "VIENNA · UPDATED 12S AGO". 10 / 0.08em / upper */
  monoMeta: mono(10, NORMAL, { tracking: 0.08, upper: true, maxScale: 1.35 }),
  /** Outline badges "no coordinates". 10 / 0.06em */
  monoBadge: mono(10, NORMAL, { tracking: 0.06, maxScale: 1.35 }),
  /** Legend "QUIET → PACKED". 9.5 / 0.08em / upper */
  monoLegend: mono(9.5, NORMAL, { tracking: 0.08, upper: true, maxScale: 1.35 }),
  /** "DISCARDED ON DEVICE". 9.5 / 0.06em / upper */
  monoTiny: mono(9.5, NORMAL, { tracking: 0.06, upper: true }),
  /** Policy footer line. 10.5 / 1.8 */
  monoFootnote: mono(10.5, 1.8),
  /** Consent timestamps under toggles. 11.5 / 1.45 */
  monoCaption: mono(11.5, 1.45),
  /** List sub-line, rotation line. 11 */
  monoSub: mono(11, NORMAL),
  /** Discarded-coordinate line. 11 / 1.7 */
  monoSubLong: mono(11, 1.7),
  /** Rotating ID. 12 / 1.7 */
  monoId: mono(12, 1.7),
  /** Payload preview. 11.5 / 1.85 */
  monoCode: mono(11.5, 1.85),
  /** Approximate counts "~25". 13 */
  monoData: mono(13, NORMAL, { maxScale: 1.35 }),
  /** Trend glyph ↑ ↓ ·. 12 */
  monoGlyph: mono(12, NORMAL, { maxScale: 1.35 }),
  /** "{}" inspector button. 12.5 */
  monoButton: mono(12.5, NORMAL, { maxScale: 1 }),
  /** Compass "N". 8 / 0.06em */
  monoCompass: mono(8, NORMAL, { tracking: 0.06, maxScale: 1 }),
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;
