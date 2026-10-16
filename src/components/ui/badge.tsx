import { StyleSheet, Text } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

export function Badge({ label, variant = 'neutral' }: { label: string; variant?: BadgeVariant }) {
  const theme = useTheme();
  const backgroundColor = {
    primary: theme.primarySurface,
    secondary: theme.secondarySurface,
    success: theme.successSurface,
    warning: theme.warningSurface,
    danger: theme.dangerSurface,
    neutral: theme.backgroundSelected,
  }[variant];
  const textColor = {
    primary: theme.primaryForeground,
    secondary: theme.secondaryForeground,
    success: theme.successForeground,
    warning: theme.warningForeground,
    danger: theme.dangerForeground,
    neutral: theme.text,
  }[variant];

  return <Text accessibilityLabel={label} style={[styles.base, { color: textColor, backgroundColor }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, ...Typography.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
});