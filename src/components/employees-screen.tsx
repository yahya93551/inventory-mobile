import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, Input, LoadingState } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useEmployees, type Employee } from '@/hooks/use-employees';
import { useTheme } from '@/hooks/use-theme';

export function EmployeesScreen() {
  const theme = useTheme();
  const state = useEmployees();
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState<Employee | null>(null);
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<'accountant' | 'sales'>('sales');
  const [error, setError] = useState<string | null>(null);
  const isOwner = state.role === 'owner';

  const add = async () => {
    if (!identifier.trim() || password.length < 6) { setError('Email or phone and a password of at least 6 characters are required.'); return; }
    setBusy(true); setError(null);
    const message = await state.addEmployee({ identifier: identifier.trim(), password, role: newRole });
    setBusy(false);
    if (message) setError(message); else { setFormOpen(false); setIdentifier(''); setPassword(''); }
  };

  return <AppShell title="Employees" subtitle="Manage tenant team access and roles." action={isOwner ? <Text style={{ color: theme.primary, fontSize: 26 }}>+</Text> : undefined} actionLabel="Add employee" onActionPress={isOwner ? () => setFormOpen(true) : undefined}><ScrollView contentContainerStyle={styles.content}>{!isOwner && !state.loading ? <Card><EmptyState title="Owner access required" description="Only owners can manage employees." /></Card> : state.loading ? <Card><LoadingState label="Loading employees..." /></Card> : state.error ? <Card><EmptyState title="Employees unavailable" description={state.error} action={<Button label="Try again" variant="secondary" onPress={state.refresh} />} /></Card> : <><Input value={state.query} onChangeText={state.setQuery} placeholder="Search email or role" />{state.filtered.length === 0 ? <Card><EmptyState title={state.query ? 'No matching employees' : 'No employees yet'} description="Add an accountant or sales user to this tenant." action={!state.query ? <Button label="Add employee" onPress={() => setFormOpen(true)} /> : undefined} /></Card> : state.filtered.map((employee) => <Card key={employee.user_id} compact><View style={styles.row}><View style={styles.copy}><Text style={[styles.email, { color: theme.text }]} numberOfLines={1}>{employee.user_email}</Text><Text style={[styles.date, { color: theme.textSecondary }]}>Added {new Date(employee.created_at).toLocaleDateString()}</Text><Badge label={employee.active ? employee.role : 'Inactive'} variant={employee.active ? 'primary' : 'neutral'} /></View><View style={styles.actions}><Button label="Role" size="sm" variant="secondary" onPress={async () => { const nextRole = employee.role === 'sales' ? 'accountant' : 'sales'; setBusy(true); await state.changeRole(employee.user_id, nextRole); setBusy(false); }} loading={busy} /><Button label="Remove" size="sm" variant="danger" onPress={() => setConfirming(employee)} /></View></View></Card>)}</>}</ScrollView><Modal visible={formOpen} animationType="slide" onRequestClose={() => !busy && setFormOpen(false)}><View style={[styles.modal, { backgroundColor: theme.background }]}><View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Add employee</Text><Pressable onPress={() => setFormOpen(false)}><Text style={{ color: theme.primary }}>Close</Text></Pressable></View>{error && <Text style={{ color: theme.danger }}>{error}</Text>}<Input label="Email or phone" value={identifier} onChangeText={setIdentifier} placeholder="employee@example.com" autoCapitalize="none" /><Input label="Temporary password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry /><Text style={[styles.label, { color: theme.text }]}>Role</Text><View style={styles.roleRow}><Button label="Sales" size="sm" variant={newRole === 'sales' ? 'primary' : 'secondary'} onPress={() => setNewRole('sales')} /><Button label="Accountant" size="sm" variant={newRole === 'accountant' ? 'primary' : 'secondary'} onPress={() => setNewRole('accountant')} /></View><Button label="Create employee" loading={busy} fullWidth onPress={add} /></View></Modal><Modal visible={confirming !== null} transparent animationType="fade" onRequestClose={() => setConfirming(null)}><View style={styles.overlay}><Card style={styles.confirm}><Text style={[styles.title, { color: theme.text }]}>Remove employee?</Text><Text style={{ color: theme.textSecondary }}>This removes the tenant membership for {confirming?.user_email}.</Text><View style={styles.roleRow}><Button label="Cancel" variant="secondary" onPress={() => setConfirming(null)} /><Button label="Remove" variant="danger" loading={busy} onPress={async () => { if (!confirming) return; setBusy(true); const message = await state.removeEmployee(confirming.user_id); setBusy(false); if (message) setError(message); else setConfirming(null); }} /></View></Card></View></Modal></AppShell>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.two, paddingBottom: Spacing.five }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two }, copy: { flex: 1, gap: Spacing.one }, email: { ...Typography.label, fontSize: 16 }, date: { ...Typography.caption }, actions: { gap: Spacing.one }, modal: { flex: 1, padding: Spacing.four, paddingTop: Spacing.five, gap: Spacing.three }, header: { flexDirection: 'row', justifyContent: 'space-between' }, title: { ...Typography.sectionTitle }, label: { ...Typography.label }, roleRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }, overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: Spacing.four }, confirm: { gap: Spacing.three },
});
