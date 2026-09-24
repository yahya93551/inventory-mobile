import { Stack, useLocalSearchParams } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, Input, LoadingState } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useDebts, type Customer } from '@/hooks/use-debts';
import { useTheme } from '@/hooks/use-theme';
import { EmployeesScreen } from '@/components/employees-screen';
import { CategoriesScreen } from '@/components/categories-screen';
import { SettingsScreen } from '@/components/settings-screen';
import { useState } from 'react';

const labels: Record<string, { title: string; subtitle: string; description: string }> = {
  purchases: { title: 'Purchases', subtitle: 'Incoming stock and suppliers.', description: 'Purchase workflows will be added in a later phase.' },
  debts: { title: 'Debts', subtitle: 'Outstanding balances.', description: 'Debt tracking will be added in a later phase.' },
  employees: { title: 'Employees', subtitle: 'Team access and roles.', description: 'Employee management will be added in a later phase.' },
  categories: { title: 'Categories', subtitle: 'Organize your catalog.', description: 'Category management will be added in a later phase.' },
  settings: { title: 'Settings', subtitle: 'Business and account preferences.', description: 'Settings will be added in a later phase.' },
  support: { title: 'Support', subtitle: 'Help with MyInventory.', description: 'Support tools will be added in a later phase.' },
};

const styles = StyleSheet.create({
  debtContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  debtTotal: { ...Typography.screenTitle, marginVertical: Spacing.one },
  debtFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  customerCopy: { flex: 1, gap: Spacing.half },
  customerName: { ...Typography.label, fontSize: 16 },
  debtMeta: { ...Typography.caption },
  balance: { alignItems: 'flex-end', gap: Spacing.half },
  balanceValue: { ...Typography.metric, fontSize: 20 },
  debtModal: { flex: 1, padding: Spacing.four, paddingTop: Spacing.five },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.four },
  title: { ...Typography.sectionTitle },
  actionColumn: { gap: Spacing.one },
});

export default function MorePlaceholderScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const content = labels[section] ?? labels.support;

  if (section === 'purchases') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppShell title="Purchases" subtitle="Incoming stock and suppliers.">
          <Card style={{ marginBottom: Spacing.three }}>
            <EmptyState
              title="Purchases are not available"
              description="The web application does not currently define purchase records, purchase reports, or a protected purchase workflow. No purchase data or stock changes are shown here."
            />
          </Card>
        </AppShell>
      </>
    );
  }

  if (section === 'debts') return <DebtsScreen />;
  if (section === 'employees') return <EmployeesScreen />;
  if (section === 'categories') return <CategoriesScreen />;
  if (section === 'settings') return <SettingsScreen />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PlaceholderScreen {...content} />
    </>
  );
}

function DebtsScreen() {
  const theme = useTheme();
  const state = useDebts();
  const [selected, setSelected] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const isOwner = state.role === 'owner';
  const totals = { total: state.debts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0), outstanding: state.debts.reduce((sum, debt) => sum + (debt.paid ? 0 : Number(debt.amount || 0)), 0) };
  return <AppShell title="Debts" subtitle="Customer balances and payment status."><ScrollView contentContainerStyle={styles.debtContent}><Card compact><Text style={{ color: theme.textSecondary }}>Total recorded</Text><Text style={[styles.debtTotal, { color: theme.text }]}>{totals.total.toFixed(2)}</Text><Text style={{ color: theme.warning }}>Outstanding {totals.outstanding.toFixed(2)}</Text></Card>{!isOwner && !state.loading ? <Card><EmptyState title="Owner access required" description="Only owners can view and manage debt records." /></Card> : state.loading ? <Card><LoadingState label="Loading debts..." /></Card> : state.error ? <Card><EmptyState title="Debts unavailable" description={state.error} action={<Button label="Try again" variant="secondary" onPress={state.refresh} />} /></Card> : <><Input value={state.query} onChangeText={state.setQuery} placeholder="Search customer, phone, amount, or note" /><View style={styles.debtFilters}><Button label="All" size="sm" variant={state.filter === 'all' ? 'primary' : 'secondary'} onPress={() => state.setFilter('all')} /><Button label="Unpaid" size="sm" variant={state.filter === 'unpaid' ? 'primary' : 'secondary'} onPress={() => state.setFilter('unpaid')} /><Button label="Latest" size="sm" variant={state.sortBy === 'latest' ? 'primary' : 'secondary'} onPress={() => state.setSortBy('latest')} /><Button label="Balance" size="sm" variant={state.sortBy === 'high-balance' ? 'primary' : 'secondary'} onPress={() => state.setSortBy('high-balance')} /></View>{state.customers.length === 0 ? <Card><EmptyState title={state.query || state.filter === 'unpaid' ? 'No matching debts' : 'No debts recorded'} description="Debt records created by unpaid sales will appear here." /></Card> : state.customers.map((customer) => <Card key={customer.phone} compact interactive onPress={() => setSelected(customer)}><View style={styles.customerRow}><View style={styles.customerCopy}><Text style={[styles.customerName, { color: theme.text }]}>{customer.name || 'Unnamed customer'}</Text><Text style={{ color: theme.textSecondary }}>{customer.phone}</Text><Text style={[styles.debtMeta, { color: theme.textSecondary }]}>{customer.debts.length} record{customer.debts.length === 1 ? '' : 's'} · {customer.latestDate}</Text></View><View style={styles.balance}><Text style={{ color: theme.textSecondary }}>Outstanding</Text><Text style={[styles.balanceValue, { color: customer.outstanding > 0 ? theme.warning : theme.success }]}>{customer.outstanding.toFixed(2)}</Text><Text style={{ color: theme.textSecondary }}>Total {customer.total.toFixed(2)}</Text></View></View></Card>)}</>}</ScrollView><Modal visible={selected !== null} animationType="slide" onRequestClose={() => setSelected(null)}><ScrollView style={[styles.debtModal, { backgroundColor: theme.background }]} contentContainerStyle={styles.debtContent}><View style={styles.modalHeader}><Text style={[styles.title, { color: theme.text }]}>Debt details</Text><Pressable onPress={() => setSelected(null)}><Text style={{ color: theme.primary }}>Close</Text></Pressable></View>{selected && <>{selected.debts.map((debt) => <Card key={debt.id} compact><View style={styles.customerRow}><View style={styles.customerCopy}><Text style={[styles.balanceValue, { color: theme.text }]}>{Number(debt.amount).toFixed(2)}</Text><Text style={{ color: theme.textSecondary }}>{debt.date}</Text>{debt.note && <Text style={{ color: theme.textSecondary }}>{debt.note}</Text>}</View>{debt.paid ? <Text style={{ color: theme.success }}>Paid</Text> : <View style={styles.actionColumn}><Button label="Mark paid" size="sm" loading={busy} onPress={async () => { setBusy(true); await state.markPaid(debt.id); setBusy(false); }} /><Button label="Delete" size="sm" variant="danger" loading={busy} onPress={async () => { setBusy(true); await state.deleteDebt(debt.id); setBusy(false); setSelected(null); }} /></View>}</View></Card>)}</>}</ScrollView></Modal></AppShell>;
}