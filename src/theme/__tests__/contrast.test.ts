import {
  darkColors,
  darkHighContrast,
  lightColors,
  lightHighContrast,
  type ColorTokens,
} from '@/theme/tokens';

/** WCAG 2.x relative luminance and contrast ratio for #rrggbb colours. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const READING_ROLES = ['primary', 'body', 'secondary', 'tertiary', 'muted'] as const;

function minContrast(c: ColorTokens): number {
  let min = Infinity;
  for (const role of READING_ROLES) {
    for (const bg of [c.surface.base, c.surface.subtle]) {
      min = Math.min(min, contrast(c.text[role], bg));
    }
  }
  return min;
}

describe('text contrast', () => {
  it('high-contrast themes meet WCAG AA (4.5:1) for every reading colour', () => {
    expect(minContrast(lightHighContrast)).toBeGreaterThanOrEqual(4.5);
    expect(minContrast(darkHighContrast)).toBeGreaterThanOrEqual(4.5);
  });

  it('the dark theme meets AA by default', () => {
    expect(minContrast(darkColors)).toBeGreaterThanOrEqual(4.5);
  });

  it('documents the design palette: its muted grey is below AA on white', () => {
    // Kept as designed; Increase Contrast switches to lightHighContrast.
    expect(contrast(lightColors.text.muted, lightColors.surface.base)).toBeLessThan(4.5);
    expect(contrast(lightColors.text.secondary, lightColors.surface.base)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
