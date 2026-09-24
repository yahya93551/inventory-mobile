import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = PressableProps & {
  children: React.ReactNode;
  compact?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, compact = false, interactive = false, disabled, style, ...props }: CardProps) {
  const theme = useTheme();

  const cardStyle = [
    styles.base,
    { backgroundColor: theme.card, borderColor: theme.border },
    compact ? styles.compact : styles.standard,
    style,
  ];

  if (!interactive) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        ...cardStyle,
        pressed && styles.pressed,
        style,
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
  pressed: { opacity: 0.82 },
});