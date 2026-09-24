import { StyleSheet, Text } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { Card, EmptyState } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function PlaceholderScreen({ title, subtitle, description }: { title: string; subtitle: string; description: string }) {
  const theme = useTheme();

  return (
    <AppShell title={title} subtitle={subtitle}>
      <Card style={styles.card}>
        <EmptyState title="Coming in a later phase" description={description} />
      </Card>
      <Text style={[styles.note, { color: theme.textMuted }]}>Your workspace navigation is ready for the next feature set.</Text>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.three },
  note: { ...Typography.caption, textAlign: 'center' },
});