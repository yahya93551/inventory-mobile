import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const variantStyle = stylesForVariant(theme, variant);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        variantStyle.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}>
      {loading ? <ActivityIndicator color={variantStyle.text.color} /> : icon}
      <Text style={[styles.label, variantStyle.text]}>{loading ? 'Loading...' : label}</Text>
    </Pressable>
  );
}

function stylesForVariant(theme: ReturnType<typeof useTheme>, variant: ButtonVariant) {
  const variants = {
    primary: { container: { backgroundColor: theme.primary }, text: { color: '#ffffff' } },
    secondary: { container: { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }, text: { color: theme.text } },
    danger: { container: { backgroundColor: theme.danger }, text: { color: '#ffffff' } },
    success: { container: { backgroundColor: theme.success }, text: { color: '#ffffff' } },
    warning: { container: { backgroundColor: theme.warning }, text: { color: '#ffffff' } },
    ghost: { container: { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 }, text: { color: theme.textSecondary } },
  } as const;

  return variants[variant];
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  sm: { minHeight: 40, paddingHorizontal: Spacing.two },
  md: { minHeight: 48 },
  lg: { minHeight: 54, paddingHorizontal: Spacing.four },
  fullWidth: { width: '100%' },
  label: { ...Typography.label },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});