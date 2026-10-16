import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
      {detail ? <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xxs },
  title: { ...Typography.sectionTitle },
  detail: { ...Typography.helper },
});