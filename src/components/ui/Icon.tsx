import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * The design draws its few icons with CSS primitives (rings, a dot, a CSS
 * triangle) rather than an icon font. These are exact SVG redraws of those
 * primitives; there is deliberately no icon library.
 */

interface RingProps {
  /** Outer diameter in points. */
  size?: number;
  stroke?: number;
  color?: string;
}

/** Hollow ring. Search field (13 / 1.5 / muted) and settings button (13 / 1.5 / ink). */
export function RingIcon({ size = 13, stroke = 1.5, color }: RingProps) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color ?? colors.text.primary}
        strokeWidth={stroke}
        fill="none"
      />
    </Svg>
  );
}

/** Locate-me: 15 pt ring, 2 pt stroke, 4 pt centre dot. Grey when location is unavailable. */
export function LocateIcon({ color }: { color?: string }) {
  const { colors, size } = useTheme();
  const c = color ?? colors.text.primary;
  const d = size.locateRing;
  return (
    <Svg width={d} height={d}>
      <Circle cx={d / 2} cy={d / 2} r={(d - 2) / 2} stroke={c} strokeWidth={2} fill="none" />
      <Circle cx={d / 2} cy={d / 2} r={size.locateDot / 2} fill={c} />
    </Svg>
  );
}

/**
 * Compass needle: the design's CSS triangle (10 wide, 11 tall, red), drawn
 * inside a 26 pt face. The "N" label is rendered by the Compass control.
 */
export function NeedleIcon() {
  const { colors, size } = useTheme();
  const d = size.compassFace;
  const top = 3;
  return (
    <Svg width={d} height={d}>
      <Path
        d={`M${d / 2} ${top} L${d / 2 + 5} ${top + 11} L${d / 2 - 5} ${top + 11} Z`}
        fill={colors.map.compassNeedle}
      />
    </Svg>
  );
}
