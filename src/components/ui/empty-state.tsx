import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {description && <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.two },
  title: { ...Typography.sectionTitle, textAlign: 'center' },
  description: { ...Typography.body, textAlign: 'center' },
});