import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, FeedbackMessage, LoadingState, SectionHeader } from '@/components/ui';
import { CategoriesScreen } from '@/components/categories-screen';
import { EmployeesScreen } from '@/components/employees-screen';
import { SubscriptionScreen } from '@/components/subscription-screen';
import { DebtsScreen } from '@/app/(protected)/more/[section]';
import { SettingsScreen } from '@/components/settings-screen';
import { ControlHeights, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MoreSection = 'debts' | 'employees' | 'categories' | 'settings' | 'subscription';
type MoreIcon = Exclude<SymbolViewProps['name'], string>;
type MoreItem = { key: MoreSection; label: string; description: string; icon: MoreIcon; roles: TenantRole[] };

const menuSections: { title: string; items: MoreItem[] }[] = [
  {
    title: 'Catalog',
    items: [{ key: 'categories', label: 'Categories', description: 'Organize your product catalog.', icon: { ios: 'folder', android: 'category', web: 'category' }, roles: ['owner', 'accountant'] }],
  },
  {
    title: 'Team',
    items: [{ key: 'employees', label: 'Employees', description: 'Manage team access and roles.', icon: { ios: 'person.2', android: 'group', web: 'group' }, roles: ['owner'] }],
  },
  {
    title: 'Finance',
    items: [{ key: 'debts', label: 'Debts', description: 'Review outstanding customer balances.', icon: { ios: 'creditcard', android: 'payments', web: 'payments' }, roles: ['owner'] }],
  },
  {
    title: 'Account',
    items: [
      { key: 'settings', label: 'Settings', description: 'View business details and app preferences.', icon: { ios: 'gearshape', android: 'settings', web: 'settings' }, roles: ['owner', 'accountant'] },
      { key: 'subscription', label: 'Subscription', description: 'Review your plan and request activation.', icon: { ios: 'creditcard', android: 'credit_card', web: 'credit_card' }, roles: ['owner'] },
    ],
  },
];

function MoreMenuRow({ item, last, onPress }: { item: MoreItem; last: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}. ${item.description}`}
      accessibilityHint={`Opens ${item.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, { borderBottomColor: theme.border }, last && styles.menuRowLast, pressed && styles.pressed]}>
      <View style={[styles.menuIcon, { backgroundColor: theme.backgroundSelected }]}>
        <SymbolView name={item.icon} tintColor={theme.primaryStrong} size={20} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
        <Text style={[styles.menuDescription, { color: theme.textSecondary }]}>{item.description}</Text>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={theme.textMuted} size={18} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const theme = useTheme();
  const { role, loading: roleLoading } = useTenantRole();
  const { signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<'categories' | 'debts' | 'employees' | 'settings' | 'subscription' | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      const result = await signOut();
      if (result.error) setLogoutError(result.error);
    } catch (signOutError) {
      setLogoutError(signOutError instanceof Error ? signOutError.message : 'Unable to log out. Please try again.');
    } finally {
      setLogoutBusy(false);
    }
  };

  const visibleSections = role
    ? menuSections.map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(role)) })).filter((section) => section.items.length > 0)
    : [];

  if (activeSection === 'categories') return <CategoriesScreen onBack={() => setActiveSection(null)} />;
  if (activeSection === 'debts') return <DebtsScreen onBack={() => setActiveSection(null)} />;
  if (activeSection === 'employees') return <EmployeesScreen onBack={() => setActiveSection(null)} />;
  if (activeSection === 'settings') return <SettingsScreen onBack={() => setActiveSection(null)} />;
  if (activeSection === 'subscription') return <SubscriptionScreen onBack={() => setActiveSection(null)} />;

  return (
    <AppShell title="More" subtitle="Workspace tools and account settings.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card compact style={styles.accountCard}>
          <SectionHeader title="Workspace access" detail="Available sections follow your current workspace role." />
          {roleLoading ? (
            <LoadingState label="Checking workspace access..." />
          ) : role ? (
            <View style={styles.roleRow}>
              <Text style={[styles.roleLabel, { color: theme.textSecondary }]}>Your role</Text>
              <Badge label={role} variant="primary" />
            </View>
          ) : (
            <EmptyState title="Workspace access unavailable" description="No active workspace role is available for this account." />
          )}
        </Card>

        {roleLoading ? null : visibleSections.length > 0 ? (
          <View style={styles.sections}>
            {visibleSections.map((section) => (
              <View key={section.title} style={styles.section}>
                <SectionHeader title={section.title} />
                <View style={[styles.menuGroup, { borderColor: theme.border }]}>
                  {section.items.map((item, index) => <MoreMenuRow key={item.key} item={item} last={index === section.items.length - 1} onPress={() => item.key === 'categories' || item.key === 'debts' || item.key === 'employees' || item.key === 'settings' || item.key === 'subscription' ? setActiveSection(item.key) : router.push({ pathname: '/more/[section]', params: { section: item.key } })} />)}
                </View>
              </View>
            ))}
          </View>
        ) : role ? (
          <EmptyState title="No additional sections" description="There are no other workspace tools available for your role." />
        ) : null}

        <View style={styles.session}>
          <SectionHeader title="Session" />
          {logoutError && <FeedbackMessage message={logoutError} />}
          <Button label="Log out" variant="danger" fullWidth loading={logoutBusy} disabled={logoutBusy} onPress={() => void handleSignOut()} />
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.xl, paddingBottom: Spacing.xxl },
  accountCard: { gap: Spacing.md },
  roleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, minHeight: ControlHeights.standard },
  roleLabel: { ...Typography.label },
  sections: { gap: Spacing.xl },
  section: { gap: Spacing.sm },
  menuGroup: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  menuRow: { minHeight: ControlHeights.large, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, gap: Spacing.xxs },
  menuLabel: { ...Typography.label },
  menuDescription: { ...Typography.helper },
  session: { gap: Spacing.md },
  pressed: { opacity: 0.72 },
});