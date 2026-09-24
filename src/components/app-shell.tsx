import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { MobileHeader } from '@/components/mobile-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AppShellProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  onActionPress?: () => void;
  actionLabel?: string;
  children: ReactNode;
};

export function AppShell({ title, subtitle, action, onActionPress, actionLabel, children }: AppShellProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MobileHeader title={title} subtitle={subtitle} action={action} onActionPress={onActionPress} actionLabel={actionLabel} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
});