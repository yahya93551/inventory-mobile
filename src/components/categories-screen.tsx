import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, Input, LoadingState } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';

export function CategoriesScreen() {
  const theme = useTheme();
  const state = useCategories();
  const canManage = state.role === 'owner' || state.role === 'accountant';
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const openForm = (category?: string) => { setEditing(category || null); setValue(category || ''); setFormError(null); setFormOpen(true); };
  const save = async () => { if (!value.trim()) { setFormError('Category name is required.'); return; } setBusy(true); setFormError(null); const message = editing ? await state.updateCategory(editing, value) : await state.addCategory(value); setBusy(false); if (message) setFormError(message); else setFormOpen(false); };
  return <AppShell title="Categories" subtitle="Organize your product catalog." action={canManage ? <Text style={{ color: theme.primary, fontSize: 26 }}>+</Text> : undefined} actionLabel="Add category" onActionPress={canManage ? () => openForm() : undefined}><ScrollView contentContainerStyle={styles.content}>{!canManage && !state.loading ? <Card><EmptyState title="Management access required" description="Only owners and accountants can manage categories." /></Card> : state.loading ? <Card><LoadingState label="Loading categories..." /></Card> : state.error ? <Card><EmptyState title="Categories unavailable" description={state.error} action={<Button label="Try again" variant="secondary" onPress={state.refresh} />} /></Card> : <><Input value={state.query} onChangeText={state.setQuery} placeholder="Search categories" />{state.filtered.length === 0 ? <Card><EmptyState title={state.query ? 'No matching categories' : 'No categories yet'} description="Add a category to organize products." action={!state.query ? <Button label="Add category" onPress={() => openForm()} /> : undefined} /></Card> : state.filtered.map((category) => <Card key={category} compact><View style={styles.row}><View style={styles.copy}><Text style={[styles.name, { color: theme.text }]}>{category}</Text><Badge label="Category" variant="neutral" /></View><View style={styles.actions}><Button label="Edit" size="sm" variant="secondary" onPress={() => openForm(category)} /><Button label="Delete" size="sm" variant="danger" onPress={() => { setEditing(category); setFormError(null); }} /></View></View>{editing === category && !formOpen && <View style={styles.deleteConfirm}><Text style={{ color: theme.warning }}>Deleting does not reassign products using this category.</Text><View style={styles.confirmRow}><Button label="Cancel" size="sm" variant="secondary" onPress={() => setEditing(null)} /><Button label="Confirm delete" size="sm" variant="danger" loading={busy} onPress={async () => { setBusy(true); const message = await state.deleteCategory(category); setBusy(false); if (message) setFormError(message); else setEditing(null); }} /></View>{formError && <Text style={{ color: theme.danger }}>{formError}</Text>}</View>}</Card>)}</>}</ScrollView><Modal visible={formOpen} animationType="slide" onRequestClose={() => !busy && setFormOpen(false)}><View style={[styles.modal, { backgroundColor: theme.background }]}><View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>{editing ? 'Edit category' : 'Add category'}</Text><Pressable onPress={() => setFormOpen(false)}><Text style={{ color: theme.primary }}>Close</Text></Pressable></View>{formError && <Text style={{ color: theme.danger }}>{formError}</Text>}<Input label="Category name" value={value} onChangeText={setValue} placeholder="Category name" maxLength={50} /><Button label={editing ? 'Save changes' : 'Add category'} loading={busy} fullWidth onPress={save} /></View></Modal></AppShell>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.two, paddingBottom: Spacing.five }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two }, copy: { flex: 1, gap: Spacing.one }, name: { ...Typography.label, fontSize: 16 }, actions: { gap: Spacing.one }, deleteConfirm: { marginTop: Spacing.three, gap: Spacing.two }, confirmRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }, modal: { flex: 1, padding: Spacing.four, paddingTop: Spacing.five, gap: Spacing.three }, header: { flexDirection: 'row', justifyContent: 'space-between' }, title: { ...Typography.sectionTitle },
});
