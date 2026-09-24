import { StyleSheet, Text } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

export function Badge({ label, variant = 'neutral' }: { label: string; variant?: BadgeVariant }) {
  const theme = useTheme();
  const color = {
    primary: theme.primary,
    secondary: theme.secondary,
    success: theme.success,
    warning: theme.warning,
    danger: theme.danger,
    neutral: theme.textSecondary,
  }[variant];

  return <Text style={[styles.base, { color, backgroundColor: `${color}22` }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, ...Typography.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
});