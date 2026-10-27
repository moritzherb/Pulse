import { useId } from 'react';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';

import { heatLevels, useTheme, type HeatLevel, type LevelPattern } from '@/theme';

export interface LevelSwatchProps {
  level: HeatLevel;
  /** Square edge in points. The design's list swatch is 10. */
  size?: number;
}

/**
 * Colour square for a crowd level, overlaid with that level's pattern so
 * levels stay distinguishable without colour (quiet: plain, moderate: dots,
 * busy: diagonal lines, packed: cross-hatch). fill-in: patterns are not in
 * the design; the swatch shape and 3 pt radius are.
 */
export function LevelSwatch({ level, size }: LevelSwatchProps) {
  const theme = useTheme();
  const d = size ?? theme.size.swatch;
  const { color, pattern, label } = heatLevels[level];
  const id = `lvl-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const r = d <= 12 ? theme.radius.swatch : theme.radius.item;
  return (
    <Svg width={d} height={d} accessibilityLabel={label} accessible>
      <Defs>{patternDef(id, pattern, d)}</Defs>
      <Rect width={d} height={d} rx={r} fill={color} />
      {pattern !== 'none' && <Rect width={d} height={d} rx={r} fill={`url(#${id})`} />}
    </Svg>
  );
}

/** Pattern tiles. Tile size scales a little with the swatch so 10 pt swatches still read. */
function patternDef(id: string, pattern: LevelPattern, d: number) {
  const t = d <= 12 ? 3.4 : 5;
  const ink = 'rgba(255,255,255,0.85)';
  const w = d <= 12 ? 0.9 : 1.2;
  switch (pattern) {
    case 'dots':
      return (
        <Pattern id={id} width={t} height={t} patternUnits="userSpaceOnUse">
          <Circle cx={t / 2} cy={t / 2} r={w * 0.75} fill={ink} />
        </Pattern>
      );
    case 'lines':
      return (
        <Pattern
          id={id}
          width={t}
          height={t}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Line x1={0} y1={0} x2={0} y2={t} stroke={ink} strokeWidth={w} />
        </Pattern>
      );
    case 'cross':
      return (
        <Pattern
          id={id}
          width={t}
          height={t}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Line x1={0} y1={0} x2={0} y2={t} stroke={ink} strokeWidth={w} />
          <Line x1={0} y1={0} x2={t} y2={0} stroke={ink} strokeWidth={w} />
        </Pattern>
      );
    default:
      return null;
  }
}
