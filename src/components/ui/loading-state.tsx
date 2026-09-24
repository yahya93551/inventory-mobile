import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  const theme = useTheme();

  return (
    <View accessibilityRole="progressbar" style={styles.container}>
      <ActivityIndicator color={theme.primary} size="small" />
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  label: { ...Typography.body },
});