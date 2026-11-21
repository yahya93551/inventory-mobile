import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, FeedbackMessage, Input, KeyboardAwareScrollView, LoadingState, SectionHeader } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useTenantRole } from '@/auth';
import { useTheme } from '@/hooks/use-theme';
import { callWebApi } from '@/lib/web-api';

type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea' | 'currency';
type ProductField = {
  id: string;
  field_name: string;
  display_name: string;
  field_type: FieldType;
  is_required: boolean;
  is_visible: boolean;
  is_system?: boolean;
  field_order: number;
  select_options?: string[] | null;
  default_value?: string | null;
  description?: string | null;
};

type FieldForm = {
  field_name: string;
  display_name: string;
  field_type: FieldType;
  is_required: boolean;
  is_visible: boolean;
  select_options: string;
  default_value: string;
  description: string;
};

const fieldTypes: FieldType[] = ['text', 'number', 'date', 'select', 'checkbox', 'textarea', 'currency'];
const emptyForm: FieldForm = {
  field_name: '',
  display_name: '',
  field_type: 'text',
  is_required: false,
  is_visible: true,
  select_options: '',
  default_value: '',
  description: '',
};

export function ProductFieldsScreen({ onBack }: { onBack?: () => void }) {
  const theme = useTheme();
  const { role, loading: roleLoading } = useTenantRole();
  const [standardFields, setStandardFields] = useState<ProductField[]>([]);
  const [customFields, setCustomFields] = useState<ProductField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductField | null>(null);
  const [form, setForm] = useState<FieldForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductField | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isOwner = role === 'owner';

  const fetchFields = useCallback(() => Promise.all([
    callWebApi<ProductField[]>('/api/standard-fields'),
    callWebApi<ProductField[]>('/api/custom-fields'),
  ]), []);

  const refreshFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [standard, custom] = await fetchFields();
      setStandardFields([...standard].sort((a, b) => a.field_order - b.field_order));
      setCustomFields([...custom].sort((a, b) => a.field_order - b.field_order));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load product fields.');
    } finally {
      setLoading(false);
    }
  }, [fetchFields]);

  useEffect(() => {
    if (roleLoading || !isOwner) return;
    let active = true;
    void fetchFields()
      .then(([standard, custom]) => {
        if (!active) return;
        setError(null);
        setStandardFields([...standard].sort((a, b) => a.field_order - b.field_order));
        setCustomFields([...custom].sort((a, b) => a.field_order - b.field_order));
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load product fields.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchFields, isOwner, reloadKey, roleLoading]);

  const toggleVisibility = async (field: ProductField, visible: boolean) => {
    if (!isOwner || savingId) return;
    setSavingId(field.id);
    setError(null);
    try {
      const path = field.is_system ? '/api/standard-fields' : '/api/custom-fields';
      await callWebApi<ProductField>(path, {
        method: 'PATCH',
        body: JSON.stringify({ id: field.id, updates: { is_visible: visible } }),
      });
      const update = (items: ProductField[]) => items.map((item) => item.id === field.id ? { ...item, is_visible: visible } : item);
      if (field.is_system) setStandardFields(update);
      else setCustomFields(update);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update field visibility.');
    } finally {
      setSavingId(null);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (field: ProductField) => {
    setEditing(field);
    setForm({
      field_name: field.field_name,
      display_name: field.display_name,
      field_type: field.field_type,
      is_required: field.is_required,
      is_visible: field.is_visible,
      select_options: (field.select_options || []).join(', '),
      default_value: field.default_value || '',
      description: field.description || '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const saveField = async () => {
    if (!form.display_name.trim() || (!editing && !form.field_name.trim())) {
      setFormError('Field name and display name are required.');
      return;
    }
    if (!editing && !/^[a-z0-9_]+$/.test(form.field_name.trim())) {
      setFormError('Field name can contain only lowercase letters, numbers, and underscores.');
      return;
    }
    const options = form.select_options.split(',').map((option) => option.trim()).filter(Boolean);
    if (form.field_type === 'select' && options.length === 0) {
      setFormError('Add at least one option for a select field.');
      return;
    }

    setFormBusy(true);
    setFormError(null);
    const payload = {
      ...(!editing ? { field_name: form.field_name.trim() } : {}),
      display_name: form.display_name.trim(),
      field_type: form.field_type,
      is_required: form.is_required,
      is_visible: form.is_visible,
      field_order: editing?.field_order ?? customFields.length,
      select_options: form.field_type === 'select' ? options : undefined,
      default_value: form.default_value || undefined,
      description: form.description || undefined,
    };
    try {
      if (editing) {
        await callWebApi<ProductField>('/api/custom-fields', {
          method: 'PATCH',
          body: JSON.stringify({ id: editing.id, updates: payload }),
        });
      } else {
        await callWebApi<ProductField>('/api/custom-fields', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      setLoading(true);
      setError(null);
      await refreshFields();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Unable to save product field.');
    } finally {
      setFormBusy(false);
    }
  };

  const deleteField = async () => {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await callWebApi('/api/custom-fields', {
        method: 'DELETE',
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      setDeleteTarget(null);
      setLoading(true);
      setError(null);
      await refreshFields();
    } catch (removeError) {
      setDeleteError(removeError instanceof Error ? removeError.message : 'Unable to delete product field.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const retryLoading = () => {
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const renderField = (field: ProductField) => (
    <Card key={field.id} compact>
      <View style={styles.fieldRow}>
        <View style={styles.fieldCopy}>
          <Text style={[styles.fieldName, { color: theme.text }]}>{field.display_name}</Text>
          <Text style={[styles.fieldMeta, { color: theme.textSecondary }]}>{field.field_name} · {field.field_type}{field.is_required ? ' · required' : ''}</Text>
        </View>
        <Switch
          accessibilityLabel={`Show ${field.display_name}`}
          value={field.is_visible}
          disabled={!isOwner || savingId === field.id}
          onValueChange={(visible) => void toggleVisibility(field, visible)}
          trackColor={{ false: theme.border, true: theme.primary }}
        />
      </View>
      {!field.is_system ? (
        <View style={styles.fieldActions}>
          <Button label="Edit" size="sm" variant="secondary" disabled={savingId !== null} onPress={() => openEdit(field)} />
          <Button label="Delete" size="sm" variant="danger" disabled={savingId !== null} onPress={() => { setDeleteTarget(field); setDeleteError(null); }} />
        </View>
      ) : <Badge label="Standard field" variant="neutral" />}
    </Card>
  );

  return (
    <AppShell
      title="Product fields"
      subtitle="Choose which standard fields appear and define custom product details."
      onBack={onBack}
      action={isOwner ? <Text style={{ color: theme.primary, fontSize: 26 }}>+</Text> : undefined}
      actionLabel={isOwner ? 'Add custom field' : undefined}
      onActionPress={isOwner ? openAdd : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        {!isOwner && !roleLoading ? (
          <Card><EmptyState title="Owner access required" description="Only the business owner can manage standard and custom product fields." /></Card>
        ) : roleLoading || loading ? (
          <Card><LoadingState label="Loading product fields..." /></Card>
        ) : error ? (
          <Card><EmptyState title="Product fields unavailable" description={error} action={<Button label="Try again" variant="secondary" onPress={retryLoading} />} /></Card>
        ) : (
          <>
            <SectionHeader title="Standard fields" detail="These built-in product fields cannot be deleted, but their visibility can be changed." />
            {standardFields.map(renderField)}
            <SectionHeader title="Custom fields" detail="Add fields to capture product information specific to your business." />
            {customFields.length ? customFields.map(renderField) : (
              <Card><EmptyState title="No custom fields" description="Create a custom field to store additional product information." action={<Button label="Add custom field" onPress={openAdd} />} /></Card>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={formOpen} animationType="slide" onRequestClose={() => { if (!formBusy) setFormOpen(false); }}>
        <KeyboardAwareScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <SectionHeader title={editing ? 'Edit custom field' : 'Add custom field'} detail={editing ? 'The field key stays fixed so existing product values remain attached.' : 'Use a lowercase key with underscores, such as expiry_date.'} />
            <Button label="Close" size="sm" variant="ghost" disabled={formBusy} onPress={() => setFormOpen(false)} />
          </View>
          {formError ? <FeedbackMessage message={formError} variant="error" /> : null}
          {!editing ? <Input label="Field key" value={form.field_name} onChangeText={(value) => setForm((current) => ({ ...current, field_name: value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))} autoCapitalize="none" placeholder="expiry_date" editable={!formBusy} /> : null}
          <Input label="Display name" value={form.display_name} onChangeText={(value) => setForm((current) => ({ ...current, display_name: value }))} placeholder="Expiry date" editable={!formBusy} />
          <Text style={[styles.groupLabel, { color: theme.text }]}>Field type</Text>
          <View style={styles.typeOptions}>
            {fieldTypes.map((type) => <Button key={type} label={type} size="sm" variant={form.field_type === type ? 'primary' : 'secondary'} disabled={formBusy} onPress={() => setForm((current) => ({ ...current, field_type: type }))} />)}
          </View>
          {form.field_type === 'select' ? <Input label="Options" value={form.select_options} onChangeText={(value) => setForm((current) => ({ ...current, select_options: value }))} placeholder="Small, Medium, Large" helperText="Separate each option with a comma." editable={!formBusy} /> : null}
          <Input label="Default value (optional)" value={form.default_value} onChangeText={(value) => setForm((current) => ({ ...current, default_value: value }))} editable={!formBusy} />
          <Input label="Description (optional)" value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} multiline numberOfLines={3} editable={!formBusy} />
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>Required field</Text>
            <Switch value={form.is_required} disabled={formBusy} onValueChange={(value) => setForm((current) => ({ ...current, is_required: value }))} />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>Visible in inventory</Text>
            <Switch value={form.is_visible} disabled={formBusy} onValueChange={(value) => setForm((current) => ({ ...current, is_visible: value }))} />
          </View>
          <Button label={editing ? 'Save field' : 'Create field'} loading={formBusy} fullWidth onPress={() => void saveField()} />
        </KeyboardAwareScrollView>
      </Modal>

      <Modal visible={deleteTarget !== null} animationType="fade" transparent onRequestClose={() => { if (!deleteBusy) setDeleteTarget(null); }}>
        <View style={[styles.deleteBackdrop, { backgroundColor: `${theme.shadow}88` }]}>
          <View style={[styles.deleteDialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SectionHeader title="Delete custom field?" detail={deleteTarget ? `Delete "${deleteTarget.display_name}"? Existing product values for this field will no longer be managed.` : undefined} />
            {deleteError ? <FeedbackMessage message={deleteError} variant="error" /> : null}
            <View style={styles.fieldActions}>
              <Button label="Cancel" variant="secondary" disabled={deleteBusy} onPress={() => setDeleteTarget(null)} />
              <Button label="Delete field" variant="danger" loading={deleteBusy} onPress={() => void deleteField()} />
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.md, paddingBottom: Spacing.xxl },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  fieldCopy: { flex: 1, gap: Spacing.xxs },
  fieldName: { ...Typography.label },
  fieldMeta: { ...Typography.caption },
  fieldActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  modal: { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  groupLabel: { ...Typography.label },
  typeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { ...Typography.label },
  deleteBackdrop: { flex: 1, padding: Spacing.lg, justifyContent: 'center' },
  deleteDialog: { borderWidth: 1, borderRadius: 16, padding: Spacing.lg, gap: Spacing.md },
});
