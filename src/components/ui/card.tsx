import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = PressableProps & {
  children: React.ReactNode;
  compact?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, compact = false, interactive = false, disabled, style, accessibilityRole, accessibilityState, ...props }: CardProps) {
  const theme = useTheme();

  const cardStyle = [
    styles.base,
    { backgroundColor: theme.card, borderColor: theme.border },
    compact ? styles.compact : styles.standard,
    disabled && styles.disabled,
    style,
  ];

  if (!interactive) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        ...cardStyle,
        pressed && !disabled && styles.pressed,
      ]}
      {...props}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, borderRadius: Radius.lg },
  compact: { padding: Spacing.three },
  standard: { padding: Spacing.four },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
});