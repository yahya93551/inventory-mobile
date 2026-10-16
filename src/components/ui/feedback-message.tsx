import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FeedbackVariant = 'error' | 'success' | 'info';

const labels: Record<FeedbackVariant, string> = {
  error: 'Error',
  success: 'Success',
  info: 'Notice',
};

export function FeedbackMessage({ message, variant = 'error' }: { message: string; variant?: FeedbackVariant }) {
  const theme = useTheme();
  const colors = {
    error: { border: theme.danger, foreground: theme.dangerForeground, background: theme.dangerSurface },
    success: { border: theme.success, foreground: theme.successForeground, background: theme.successSurface },
    info: { border: theme.primary, foreground: theme.primaryForeground, background: theme.primarySurface },
  }[variant];

  return (
    <View
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={variant === 'error' ? 'assertive' : 'polite'}
      style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{labels[variant]}</Text>
      <Text style={[styles.message, { color: theme.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderLeftWidth: 4, borderRadius: Radius.sm, padding: Spacing.md, gap: Spacing.xs },
  title: { ...Typography.label },
  message: { ...Typography.helper },
});