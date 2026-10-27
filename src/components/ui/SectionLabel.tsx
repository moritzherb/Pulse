import { Text } from './Text';

export interface SectionLabelProps {
  children: string;
  /** "wide" is the consent screen's "Each one separate" (0.16em, more air). */
  variant?: 'default' | 'wide';
}

/** Mono uppercase section heading: "CONSENT", "PRIVATE AREAS". */
export function SectionLabel({ children, variant = 'default' }: SectionLabelProps) {
  const wide = variant === 'wide';
  return (
    <Text
      accessibilityRole="header"
      variant={wide ? 'monoSectionWide' : 'monoSection'}
      color="muted"
      style={{ paddingTop: wide ? 30 : 22, paddingBottom: wide ? 12 : 10 }}
    >
      {children}
    </Text>
  );
}
