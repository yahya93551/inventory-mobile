import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, Input, LoadingState } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useAuth, useTenantRole } from '@/auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { callWebApi } from '@/lib/web-api';

type BusinessSettings = { business_type: string; description?: string | null; business_name?: string | null; business_address?: string | null; business_contact_name?: string | null; business_contact_phone?: string | null; business_contact_email?: string | null; business_website?: string | null };
type FormState = Omit<BusinessSettings, 'business_type'> & { business_type: string };
const businessTypes = ['pharmacy', 'ngo', 'warehouse', 'retail_shop', 'custom'];
const emptyForm: FormState = { business_type: 'custom', description: '', business_name: '', business_address: '', business_contact_name: '', business_contact_phone: '', business_contact_email: '', business_website: '' };

export function SettingsScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading } = useTenantRole();
  const { preference, setPreference } = useThemePreference();
  const [settings, setSettings] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isOwner = role === 'owner';

  useEffect(() => {
    let mounted = true;
    if (roleLoading || !user) return () => { mounted = false; };
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const data = await callWebApi<BusinessSettings>('/api/business-settings');
        if (mounted) setSettings({ ...emptyForm, ...data });
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load business settings.');
      } finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [reloadKey, roleLoading, user]);

  const update = (key: keyof FormState, value: string) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!isOwner) return;
    if (!settings.business_type) { setError('Business type is required.'); return; }
    if (settings.business_contact_email && !/^\S+@\S+\.\S+$/.test(settings.business_contact_email)) { setError('Enter a valid contact email.'); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      const data = await callWebApi<BusinessSettings>('/api/business-settings', { method: 'POST', body: JSON.stringify(settings) });
      setSettings({ ...emptyForm, ...data }); setMessage('Business settings saved.');
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save business settings.'); }
    finally { setSaving(false); }
  };

  return <AppShell title="Settings" subtitle="Account, business, and app preferences."><ScrollView contentContainerStyle={styles.content}>{loading || roleLoading ? <Card><LoadingState label="Loading settings..." /></Card>
          : error && !settings.business_type ? <Card><EmptyState title="Settings unavailable" description={error} action={<Button label="Try again" variant="secondary" onPress={() => setReloadKey((value) => value + 1)} />} /></Card> : <><Card><Text style={[styles.sectionTitle, { color: theme.text }]}>Profile</Text><InfoRow label="Email" value={user?.email || 'Not available'} /><InfoRow label="Role" value={role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Not available'} />{user?.created_at && <InfoRow label="Account created" value={new Date(user.created_at).toLocaleDateString()} />}</Card><Card><Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text><Text style={[styles.helper, { color: theme.textSecondary }]}>Choose how the mobile app should follow light and dark colors.</Text><View style={styles.options}>{(['system', 'light', 'dark'] as ThemePreference[]).map((option) => <Button key={option} label={option.charAt(0).toUpperCase() + option.slice(1)} size="sm" variant={preference === option ? 'primary' : 'secondary'} onPress={() => setPreference(option)} />)}</View></Card><Card><Text style={[styles.sectionTitle, { color: theme.text }]}>Business settings</Text>{!isOwner && <Text style={[styles.accessNote, { color: theme.warning }]}>Only owners can edit business settings. You can view the current values.</Text>}<Input label="Business type" value={settings.business_type} onChangeText={(value) => update('business_type', value)} editable={isOwner} placeholder="custom" /><View style={styles.typeOptions}>{businessTypes.map((type) => <Button key={type} label={type.replace('_', ' ')} size="sm" variant={settings.business_type === type ? 'primary' : 'secondary'} disabled={!isOwner} onPress={() => update('business_type', type)} />)}</View><Input label="Description" value={settings.description || ''} onChangeText={(value) => update('description', value)} editable={isOwner} multiline placeholder="Describe your business" /><Input label="Business name" value={settings.business_name || ''} onChangeText={(value) => update('business_name', value)} editable={isOwner} placeholder="Business name" /><Input label="Business address" value={settings.business_address || ''} onChangeText={(value) => update('business_address', value)} editable={isOwner} placeholder="Address" /><Input label="Contact name" value={settings.business_contact_name || ''} onChangeText={(value) => update('business_contact_name', value)} editable={isOwner} placeholder="Contact name" /><Input label="Contact phone" value={settings.business_contact_phone || ''} onChangeText={(value) => update('business_contact_phone', value)} editable={isOwner} keyboardType="phone-pad" placeholder="Phone" /><Input label="Contact email" value={settings.business_contact_email || ''} onChangeText={(value) => update('business_contact_email', value)} editable={isOwner} keyboardType="email-address" autoCapitalize="none" placeholder="Email" /><Input label="Website" value={settings.business_website || ''} onChangeText={(value) => update('business_website', value)} editable={isOwner} autoCapitalize="none" placeholder="Website" />{error && <Text style={{ color: theme.danger }}>{error}</Text>}{message && <Text style={{ color: theme.success }}>{message}</Text>}{isOwner && <Button label="Save business settings" loading={saving} fullWidth onPress={save} />}</Card><Button label="Log out" variant="danger" fullWidth onPress={async () => { const result = await signOut(); if (result.error) setError(result.error); }} /></>}</ScrollView></AppShell>;
}

function InfoRow({ label, value }: { label: string; value: string }) { const theme = useTheme(); return <View style={styles.infoRow}><Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text><Text style={[styles.value, { color: theme.text }]}>{value}</Text></View>; }

const styles = StyleSheet.create({ content: { gap: Spacing.three, paddingBottom: Spacing.five }, sectionTitle: { ...Typography.sectionTitle, fontSize: 19, marginBottom: Spacing.two }, helper: { ...Typography.caption, marginBottom: Spacing.two }, options: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' }, typeOptions: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap', marginTop: -Spacing.two, marginBottom: Spacing.one }, accessNote: { ...Typography.caption, marginBottom: Spacing.two }, infoRow: { paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#94a3b833', gap: Spacing.half }, label: { ...Typography.caption }, value: { ...Typography.body, fontWeight: '600' },
});
