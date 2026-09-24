import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MobileHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  onActionPress?: () => void;
  actionLabel?: string;
};

export function MobileHeader({ title, subtitle, action, onActionPress, actionLabel }: MobileHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, Spacing.two), borderBottomColor: theme.border }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
      </View>
      {action && (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onActionPress}
          style={({ pressed }) => [styles.action, { backgroundColor: theme.surface }, pressed && styles.pressed]}>
          {action}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 76, paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  copy: { flex: 1, gap: Spacing.one },
  title: { ...Typography.screenTitle },
  subtitle: { ...Typography.caption },
  action: { minWidth: 44, minHeight: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});