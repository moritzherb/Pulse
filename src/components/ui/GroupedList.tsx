import { Children, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface GroupedListProps {
  children: ReactNode;
  /**
   * joined   - rows separated by 1 pt hairlines inside one bordered card
   *            (design: `gap: 1px; background: #e6e6e8`)
   * separate - each row its own bordered card, 8 pt apart (consent variant B)
   */
  variant?: 'joined' | 'separate';
  style?: StyleProp<ViewStyle>;
}

export function GroupedList({ children, variant = 'joined', style }: GroupedListProps) {
  const { colors, radius } = useTheme();
  if (variant === 'separate') {
    return (
      <View style={[{ gap: 8 }, style]}>
        {Children.map(children, (child) => (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border.hairline,
              borderRadius: radius.card,
              overflow: 'hidden',
            }}
          >
            {child}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View
      style={[
        {
          gap: 1,
          backgroundColor: colors.border.hairline,
          borderWidth: 1,
          borderColor: colors.border.hairline,
          borderRadius: radius.card,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
