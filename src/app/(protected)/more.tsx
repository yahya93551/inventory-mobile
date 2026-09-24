import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth, useTenantRole } from '@/auth';
import { AppShell } from '@/components/app-shell';
import { Button, Card } from '@/components/ui';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const secondaryItems = [
  { key: 'purchases', label: 'Purchases', description: 'Incoming stock and supplier activity.' },
  { key: 'debts', label: 'Debts', description: 'Track outstanding balances.' },
  { key: 'employees', label: 'Employees', description: 'Manage team access and roles.' },
  { key: 'categories', label: 'Categories', description: 'Organize your product catalog.' },
  { key: 'settings', label: 'Settings', description: 'Business and account preferences.' },
  { key: 'support', label: 'Support', description: 'Get help with MyInventory.' },
] as const;

export default function MoreScreen() {
  const theme = useTheme();
  const { role } = useTenantRole();
  const { signOut } = useAuth();
  const visibleItems = role === 'sales' ? secondaryItems.filter((item) => item.key === 'support') : secondaryItems;

  return (
    <AppShell title="More" subtitle="Workspace tools and account settings.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card compact>
          <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>Access level</Text>
          <Text style={[styles.role, { color: theme.text }]}>{role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Checking access...'}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>Navigation visibility follows your existing tenant membership.</Text>
        </Card>

        <View style={styles.menu}>
          {visibleItems.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/more/[section]', params: { section: item.key } })}
              style={({ pressed }) => [styles.menuRow, { backgroundColor: theme.card, borderColor: theme.border }, pressed && styles.pressed]}>
              <View style={styles.menuCopy}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.menuDescription, { color: theme.textSecondary }]}>{item.description}</Text>
              </View>
              <Text style={[styles.chevron, { color: theme.primary }]}>›</Text>
            </Pressable>
          ))}
        </View>

        <Button label="Log out" variant="danger" fullWidth onPress={() => void signOut()} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingBottom: Spacing.four },
  eyebrow: { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 0.8 },
  role: { ...Typography.sectionTitle, marginTop: Spacing.one },
  description: { ...Typography.caption, marginTop: Spacing.one },
  menu: { gap: Spacing.two },
  menuRow: { minHeight: 68, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, flexDirection: 'row', alignItems: 'center' },
  menuCopy: { flex: 1, gap: Spacing.half },
  menuLabel: { ...Typography.label },
  menuDescription: { ...Typography.caption },
  chevron: { fontSize: 28, lineHeight: 28, marginLeft: Spacing.two },
  pressed: { opacity: 0.75 },
});