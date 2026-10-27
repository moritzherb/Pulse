import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorTokens, type TypeVariant } from '@/theme';

type TextColor = keyof ColorTokens['text'];

export interface TextProps extends RNTextProps {
  /** Step of the type scale (see src/theme/typography.ts). */
  variant?: TypeVariant;
  /** Semantic text colour. Defaults to `primary`. */
  color?: TextColor;
  /** Render struck through, as the design does for data that is never sent. */
  strike?: boolean;
  align?: TextStyle['textAlign'];
}

/**
 * The only text component in the app. Applies the design's type scale,
 * colour roles and per-variant Dynamic Type caps.
 */
export function Text({
  variant = 'body',
  color = 'primary',
  strike,
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const t = theme.type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? t.maxScale}
      style={[
        {
          fontFamily: t.fontFamily,
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          textTransform: t.textTransform,
          color: theme.colors.text[color],
        },
        strike && { textDecorationLine: 'line-through' },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}
