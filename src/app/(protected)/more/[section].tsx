import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, FeedbackMessage, Input, KeyboardAwareScrollView, LoadingState } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useDebts, type Customer } from '@/hooks/use-debts';
import { useTheme } from '@/hooks/use-theme';
import { EmployeesScreen } from '@/components/employees-screen';
import { CategoriesScreen } from '@/components/categories-screen';
import { SettingsScreen } from '@/components/settings-screen';
import { SupportScreen } from '@/components/support-screen';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { isPhoneNumber, normalizePhoneNumber, phoneCountryOptions, splitPhoneNumber } from '@/lib/phone-number';
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
  paymentActions: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  paymentInput: { flex: 1 },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  customerCopy: { flex: 1, gap: Spacing.half },
  customerName: { ...Typography.label, fontSize: 16 },
  debtMeta: { ...Typography.caption },
  balance: { alignItems: 'flex-end', gap: Spacing.half },
  balanceValue: { ...Typography.metric, fontSize: 20 },
  customerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  overdueBadge: { ...Typography.caption, fontWeight: '700' },
  debtModal: { flex: 1, padding: Spacing.four, paddingTop: Spacing.five },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.four },
  title: { ...Typography.sectionTitle },
  actionColumn: { gap: Spacing.one },
  countryOptions: { flexDirection: 'row', gap: Spacing.one, paddingVertical: Spacing.half },
  countryCodeButton: { minWidth: 76 },
  customerActionButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

function CustomerActionButton({ label, icon, customIcon, tintColor, disabled, onPress }: {
  label: string;
  icon?: Exclude<SymbolViewProps['name'], string>;
  customIcon?: React.ReactNode;
  tintColor: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.customerActionButton,
        { backgroundColor: theme.surface, borderColor: theme.border },
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.75 },
      ]}>
      {customIcon ?? (icon ? <SymbolView name={icon} tintColor={tintColor} size={22} /> : null)}
    </Pressable>
  );
}

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
  if (section === 'support') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SupportScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PlaceholderScreen {...content} />
    </>
  );
}

export function DebtsScreen({ onBack }: { onBack?: () => void } = {}) {
  const theme = useTheme();
  const state = useDebts();
  const [selected, setSelected] = useState<Customer | null>(null);
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null);
  const [deletingDebtId, setDeletingDebtId] = useState<string | null>(null);
  const [addingDebt, setAddingDebt] = useState(false);
  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [newDebt, setNewDebt] = useState({ name: '', phone: '', countryCode: '+252', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const isOwner = state.role === 'owner';
  const totals = {
    total: state.debts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0),
    paid: state.debts.reduce((sum, debt) => sum + Number(debt.amount_paid ?? (debt.paid ? debt.amount : 0)), 0),
    outstanding: state.debts.reduce((sum, debt) => sum + Math.max(0, Number(debt.amount || 0) - Number(debt.amount_paid ?? (debt.paid ? debt.amount : 0))), 0),
    customerCount: new Set(state.debts.map((debt) => debt.customer_phone)).size,
  };
  const recordPayment = async (id: string) => {
    if (payingDebtId !== null || deletingDebtId !== null) return;
    const rawAmount = paymentAmounts[id]?.trim() ?? '';
    const amount = Number(rawAmount);
    const debt = selected?.debts.find((item) => item.id === id);
    if (!debt || !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(rawAmount) || !Number.isFinite(amount) || amount <= 0) {
      setActionError('Enter a payment amount greater than zero with up to two decimal places.');
      return;
    }

    const paidAmount = Number(debt.amount_paid ?? (debt.paid ? debt.amount : 0));
    const remaining = Math.max(0, Number(debt.amount) - paidAmount);
    if (amount > remaining) {
      setActionError(`Payment cannot exceed the remaining balance of $${remaining.toFixed(2)}.`);
      return;
    }

    setPayingDebtId(id);
    setActionError(null);
    try {
      const result = await state.recordPayment(id, amount);
      if (result.error || !result.debt) {
        setActionError(result.error || 'Unable to record debt payment.');
        return;
      }
      const updatedDebt = result.debt;
      setSelected((current) => current
        ? { ...current, debts: current.debts.map((item) => item.id === id ? updatedDebt : item) }
        : current);
      setPaymentAmounts((current) => ({ ...current, [id]: '' }));
    } catch (paymentError) {
      setActionError(paymentError instanceof Error ? paymentError.message : 'Unable to record debt payment.');
    } finally {
      setPayingDebtId(null);
    }
  };

  const deleteDebt = async (id: string) => {
    setDeletingDebtId(id);
    setActionError(null);
    try {
      const message = await state.deleteDebt(id);
      if (message) setActionError(message);
      else setSelected(null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Unable to delete debt.');
    } finally {
      setDeletingDebtId(null);
    }
  };

  const confirmDeleteDebt = (id: string, amount: number) => {
    Alert.alert(
      'Delete debt?',
      `Are you sure you want to delete this $${amount.toFixed(2)} debt? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteDebt(id) },
      ],
      { cancelable: true },
    );
  };

  const openAddDebt = (customer?: Customer) => {
    const phoneParts = splitPhoneNumber(customer?.phone || '');
    setNewDebt({
      name: customer?.name || '',
      phone: phoneParts.phone,
      countryCode: phoneParts.countryCode,
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      note: '',
    });
    setActionError(null);
    setSelected(null);
    setAddDebtOpen(true);
  };

  const openCustomerWhatsApp = async (customer: Customer) => {
    const digits = customer.phone.replace(/\D/g, '');
    if (!/^\d{7,15}$/.test(digits)) {
      Alert.alert('Invalid phone number', 'This customer does not have a usable phone number.');
      return;
    }

    const paid = customer.debts.reduce((sum, debt) => sum + Number(debt.amount_paid ?? (debt.paid ? debt.amount : 0)), 0);
    const message = `${state.businessName || 'Business'}: Sida ku cad diiwaankayaga, wadarta alaabta aad qaadatay waa $${customer.total.toFixed(2)}. ${paid > 0 ? `Waxaad bixisay lacag dhan $${paid.toFixed(2)}, ` : ''}waxaana wali kuugu harsan $${customer.outstanding.toFixed(2)}. Fadlan bixi lacagta harsan waqtiga ugu dhow. Mahadsanid.`;

    try {
      await Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`);
    } catch (linkError) {
      Alert.alert('Unable to open WhatsApp', linkError instanceof Error ? linkError.message : 'Please check that a messaging app is available.');
    }
  };

  const callCustomer = async (phone: string) => {
    const sanitizedPhone = phone.replace(/[^\d+]/g, '');
    if (!/^\+?\d{7,15}$/.test(sanitizedPhone)) {
      Alert.alert('Invalid phone number', 'This customer does not have a usable phone number.');
      return;
    }

    try {
      await Linking.openURL(`tel:${sanitizedPhone}`);
    } catch (linkError) {
      Alert.alert('Unable to start a call', linkError instanceof Error ? linkError.message : 'Please check the customer phone number.');
    }
  };

  const isCustomerOverdue = (customer: Customer) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);
    return customer.debts.some((debt) => {
      const remaining = Number(debt.amount) - Number(debt.amount_paid ?? (debt.paid ? debt.amount : 0));
      if (remaining <= 0.005) return false;
      const debtDate = new Date(`${debt.date}T00:00:00`);
      return !Number.isNaN(debtDate.getTime()) && debtDate < oneMonthAgo;
    });
  };

  const saveNewDebt = async () => {
    const name = newDebt.name.trim();
    const rawPhone = newDebt.phone.trim();
    const phoneInput = rawPhone.startsWith('+') ? rawPhone : `${newDebt.countryCode}${rawPhone}`;
    const phone = normalizePhoneNumber(phoneInput);
    const amountText = newDebt.amount.trim();
    const amount = Number(amountText);
    if (!name || !rawPhone || !newDebt.date.trim()) {
      setActionError('Enter the customer name, phone, a valid amount, and date.');
      return;
    }
    if (!isPhoneNumber(phone)) {
      setActionError('Enter a valid phone number for the selected country.');
      return;
    }
    if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(amountText) || !Number.isFinite(amount) || amount <= 0) {
      setActionError('Enter an amount greater than zero with up to two decimal places.');
      return;
    }

    const existing = state.debts.find((debt) => normalizePhoneNumber(debt.customer_phone) === phone);
    if (existing?.customer_name?.trim() && existing.customer_name.trim() !== name) {
      setActionError('This phone number already belongs to a customer with a different name. Use the same name or another phone number.');
      return;
    }

    setAddingDebt(true);
    setActionError(null);
    try {
      const error = await state.addDebt({
        customer_name: name,
        customer_phone: phone,
        amount,
        date: newDebt.date.trim(),
        note: newDebt.note.trim() || undefined,
      });
      if (error) {
        setActionError(error);
        return;
      }
      setAddDebtOpen(false);
      setNewDebt({ name: '', phone: '', countryCode: '+252', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
    } finally {
      setAddingDebt(false);
    }
  };

  return (
    <AppShell title="Debts" subtitle="Customer balances and payment status." onBack={onBack}>
      <ScrollView contentContainerStyle={styles.debtContent}>
        {actionError && !selected && <FeedbackMessage message={actionError} />}
        {state.businessSettingsError ? (
          <View>
            <FeedbackMessage message={`Business name could not be loaded for debt reminders: ${state.businessSettingsError}. Reminders will use “Business”.`} variant="info" />
            <Button label="Retry business settings" size="sm" variant="ghost" onPress={state.retryBusinessSettings} />
          </View>
        ) : null}
        <Card compact>
          <Text style={{ color: theme.textSecondary }}>Customers</Text>
          <Text style={[styles.debtTotal, { color: theme.text }]}>{totals.customerCount}</Text>
          <Text style={{ color: theme.textSecondary }}>Total recorded</Text>
          <Text style={[styles.debtTotal, { color: theme.text }]}>{totals.total.toFixed(2)}</Text>
          <Text style={{ color: theme.success }}>Paid {totals.paid.toFixed(2)}</Text>
          <Text style={{ color: theme.warning }}>Outstanding {totals.outstanding.toFixed(2)}</Text>
        </Card>
        {!isOwner && !state.loading ? (
          <Card><EmptyState title="Owner access required" description="Only owners can view and manage debt records." /></Card>
        ) : state.loading ? (
          <Card><LoadingState label="Loading debts..." /></Card>
        ) : state.error ? (
          <Card><EmptyState title="Debts unavailable" description={state.error} action={<Button label="Try again" variant="secondary" onPress={state.refresh} />} /></Card>
        ) : (
          <>
            <Button label="Add New Debt" fullWidth onPress={() => openAddDebt()} />
            <Input value={state.query} onChangeText={state.setQuery} placeholder="Search customer, phone, amount, or note" />
            <View style={styles.debtFilters}>
              <Button label="All" size="sm" variant={state.filter === 'all' ? 'primary' : 'secondary'} onPress={() => state.setFilter('all')} />
              <Button label="Unpaid" size="sm" variant={state.filter === 'unpaid' ? 'primary' : 'secondary'} onPress={() => state.setFilter('unpaid')} />
              <Button label="Latest" size="sm" variant={state.sortBy === 'latest' ? 'primary' : 'secondary'} onPress={() => state.setSortBy('latest')} />
              <Button label="Balance" size="sm" variant={state.sortBy === 'high-balance' ? 'primary' : 'secondary'} onPress={() => state.setSortBy('high-balance')} />
            </View>
            {state.customers.length === 0 ? (
              <Card><EmptyState title={state.query || state.filter === 'unpaid' ? 'No matching debts' : 'No debts recorded'} description="Debt records created by unpaid sales will appear here." /></Card>
            ) : state.customers.map((customer) => (
              <Card key={customer.phone} compact interactive onPress={() => setSelected(customer)}>
                <View style={styles.customerRow}>
                  <View style={styles.customerCopy}>
                    <View style={styles.customerRow}>
                      <Text style={[styles.customerName, { color: theme.text }]}>{customer.name || 'Unnamed customer'}</Text>
                      {isCustomerOverdue(customer) ? <Text style={[styles.overdueBadge, { color: theme.warning }]}>Overdue</Text> : null}
                    </View>
                    <Text style={{ color: theme.textSecondary }}>{customer.phone}</Text>
                    <Text style={[styles.debtMeta, { color: theme.textSecondary }]}>{customer.debts.length} record{customer.debts.length === 1 ? '' : 's'} · {customer.latestDate}</Text>
                  </View>
                  <View style={styles.balance}>
                    <Text style={{ color: theme.success }}>Paid {customer.debts.reduce((sum, debt) => sum + Number(debt.amount_paid ?? (debt.paid ? debt.amount : 0)), 0).toFixed(2)}</Text>
                    <Text style={[styles.balanceValue, { color: customer.outstanding > 0 ? theme.warning : theme.success }]}>{customer.outstanding.toFixed(2)}</Text>
                    <Text style={{ color: theme.textSecondary }}>Outstanding · total {customer.total.toFixed(2)}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
      <Modal visible={addDebtOpen} animationType="slide" onRequestClose={() => { if (!addingDebt) setAddDebtOpen(false); }}>
        <KeyboardAwareScrollView
          style={{ flex: 1, backgroundColor: theme.background }}
          contentContainerStyle={styles.debtModal}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.title, { color: theme.text }]}>Add New Debt</Text>
            <Pressable disabled={addingDebt} onPress={() => setAddDebtOpen(false)}>
              <Text style={{ color: theme.primary }}>Close</Text>
            </Pressable>
          </View>
          {actionError && <FeedbackMessage message={actionError} />}
          <Input
            label="Full name"
            value={newDebt.name}
            onChangeText={(name) => setNewDebt((current) => ({ ...current, name }))}
            placeholder="Customer name"
            editable={!addingDebt}
            autoCapitalize="words"
          />
          <View>
            <Text style={{ color: theme.text, marginBottom: Spacing.one }}>Country code</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryOptions}>
              {phoneCountryOptions.map((country) => (
                <Button
                  key={country.code}
                  label={`${country.flag} ${country.code}`}
                  size="sm"
                  variant={newDebt.countryCode === country.code ? 'primary' : 'secondary'}
                  disabled={addingDebt}
                  accessibilityLabel={`${country.country} ${country.code}`}
                  style={styles.countryCodeButton}
                  onPress={() => setNewDebt((current) => ({ ...current, countryCode: country.code }))}
                />
              ))}
            </ScrollView>
          </View>
          <Input
            label="Phone"
            value={newDebt.phone}
            onChangeText={(phone) => setNewDebt((current) => ({ ...current, phone }))}
            placeholder="Phone number"
            helperText={`Saved as ${newDebt.phone.startsWith('+') ? normalizePhoneNumber(newDebt.phone) : `${newDebt.countryCode}${newDebt.phone.replace(/[^\d]/g, '')}`}`}
            editable={!addingDebt}
            keyboardType="phone-pad"
            inputMode="tel"
          />
          <Input
            label="Amount"
            value={newDebt.amount}
            onChangeText={(amount) => setNewDebt((current) => ({ ...current, amount }))}
            placeholder="0.00"
            editable={!addingDebt}
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <Input
            label="Date"
            value={newDebt.date}
            onChangeText={(date) => setNewDebt((current) => ({ ...current, date }))}
            placeholder="YYYY-MM-DD"
            editable={!addingDebt}
          />
          <Input
            label="Note (optional)"
            value={newDebt.note}
            onChangeText={(note) => setNewDebt((current) => ({ ...current, note }))}
            placeholder="Optional note"
            editable={!addingDebt}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={styles.paymentActions}>
            <Button label="Cancel" variant="secondary" disabled={addingDebt} onPress={() => setAddDebtOpen(false)} />
            <Button label="Save Debt" loading={addingDebt} disabled={addingDebt} onPress={() => void saveNewDebt()} />
          </View>
        </KeyboardAwareScrollView>
      </Modal>
      <Modal visible={selected !== null} animationType="slide" onRequestClose={() => { if (!payingDebtId && !deletingDebtId) setSelected(null); }}>
        <ScrollView style={[styles.debtModal, { backgroundColor: theme.background }]} contentContainerStyle={styles.debtContent}>
          <View style={styles.modalHeader}>
            <Text style={[styles.title, { color: theme.text }]}>Debt details</Text>
            <Pressable disabled={payingDebtId !== null || deletingDebtId !== null} onPress={() => setSelected(null)}><Text style={{ color: theme.primary }}>Close</Text></Pressable>
          </View>
          {actionError && <FeedbackMessage message={actionError} />}
          {selected && (
            <View style={styles.customerActions}>
              <CustomerActionButton
                label="Add debt for customer"
                icon={{ ios: 'plus.circle', android: 'add_circle', web: 'add_circle' }}
                tintColor={theme.primaryStrong}
                disabled={payingDebtId !== null || deletingDebtId !== null}
                onPress={() => openAddDebt(selected)}
              />
              <CustomerActionButton
                label="WhatsApp reminder"
                customIcon={<WhatsAppIcon size={24} />}
                tintColor={theme.success}
                disabled={payingDebtId !== null || deletingDebtId !== null || state.businessNameLoading}
                onPress={() => void openCustomerWhatsApp(selected)}
              />
              <CustomerActionButton
                label="Call customer"
                icon={{ ios: 'phone', android: 'call', web: 'call' }}
                tintColor={theme.primaryStrong}
                disabled={payingDebtId !== null || deletingDebtId !== null}
                onPress={() => void callCustomer(selected.phone)}
              />
            </View>
          )}
          {selected?.debts.map((debt) => {
            const amountPaid = Number(debt.amount_paid ?? (debt.paid ? debt.amount : 0));
            const remaining = Math.max(0, Number(debt.amount) - amountPaid);
            return (
              <Card key={debt.id} compact>
                <View style={styles.customerCopy}>
                  <Text style={[styles.balanceValue, { color: theme.text }]}>Total ${Number(debt.amount).toFixed(2)}</Text>
                  <Text style={{ color: theme.textSecondary }}>{debt.date}</Text>
                  <Text style={{ color: theme.textSecondary }}>Paid ${amountPaid.toFixed(2)}</Text>
                  <Text style={{ color: remaining > 0 ? theme.warning : theme.success }}>Remaining ${remaining.toFixed(2)}</Text>
                  {debt.note && <Text style={{ color: theme.textSecondary }}>{debt.note}</Text>}
                </View>
                {debt.payments?.map((payment) => (
                  <Text key={payment.id} style={{ color: theme.textSecondary }}>
                    Payment ${Number(payment.amount).toFixed(2)} · {new Date(payment.paid_at).toLocaleString()}
                  </Text>
                ))}
                {remaining > 0 ? (
                  <View style={styles.paymentActions}>
                    <View style={styles.paymentInput}>
                      <Input
                        label="Payment amount"
                        value={paymentAmounts[debt.id] ?? ''}
                        onChangeText={(value) => setPaymentAmounts((current) => ({ ...current, [debt.id]: value }))}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        placeholder="0.00"
                        editable={payingDebtId === null && deletingDebtId === null}
                      />
                    </View>
                    <Button label="Record payment" size="sm" loading={payingDebtId === debt.id} disabled={payingDebtId !== null || deletingDebtId !== null} onPress={() => void recordPayment(debt.id)} />
                  </View>
                ) : <Text style={{ color: theme.success }}>Paid in full</Text>}
                <Button
                  label="Delete"
                  size="sm"
                  variant="danger"
                  loading={deletingDebtId === debt.id}
                  disabled={payingDebtId !== null || (deletingDebtId !== null && deletingDebtId !== debt.id)}
                  onPress={() => confirmDeleteDebt(debt.id, Number(debt.amount))}
                />
              </Card>
            );
          })}
        </ScrollView>
      </Modal>
    </AppShell>
  );
}