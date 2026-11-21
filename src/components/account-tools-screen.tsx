import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useAuth, useTenantRole } from '@/auth';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, FeedbackMessage, Input, LoadingState, SectionHeader } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { callWebApi } from '@/lib/web-api';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';
const pageSize = 20;
const activityActions = ['', 'CREATE', 'SELL', 'LOAD', 'RESTOCK', 'BULK_CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];
const activityEntities = ['', 'product', 'sale', 'user', 'settings', 'category'];

type Activity = {
  id: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  performed_by?: string | null;
  performed_by_email?: string | null;
  ip_address?: string | null;
  status_code?: number | null;
  created_at: string;
};

type ActivityResponse = { activities: Activity[]; count: number; totalPages: number };
type UserSession = { session_id: string; last_activity: string; expires_at?: string | null; ip_address?: string | null; user_agent?: string | null };
type MfaChallenge = { factorId: string; challengeId: string; method: 'totp' | 'phone'; expiresAt: number };

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

function ActivityScreen({ onBack }: { onBack?: () => void }) {
  const theme = useTheme();
  const { role, loading: roleLoading } = useTenantRole();
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [performerInput, setPerformerInput] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (roleLoading || role !== 'owner') return () => { mounted = false; };

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) });
        if (action) params.set('action', action);
        if (entity) params.set('entity', entity);
        if (performedBy) params.set('performed_by', performedBy);
        const response = await callWebApi<ActivityResponse>(`/api/activity?${params.toString()}`);
        if (!Array.isArray(response.activities) || typeof response.count !== 'number') {
          throw new Error('The activity service returned an invalid response.');
        }
        if (mounted) setData(response);
      } catch (loadError) {
        if (mounted) setError(messageOf(loadError, 'Unable to load activity logs.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [action, entity, page, performedBy, reloadKey, role, roleLoading]);

  const selectAction = (value: string) => {
    setAction(value);
    setPage(1);
  };
  const selectEntity = (value: string) => {
    setEntity(value);
    setPage(1);
  };
  const applyPerformer = () => {
    setPerformedBy(performerInput.trim());
    setPage(1);
  };

  return (
    <AppShell title="Activity log" subtitle="Review actions recorded for this workspace." onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {roleLoading ? <Card><LoadingState label="Checking owner access..." /></Card> : role !== 'owner' ? (
          <Card><EmptyState title="Owner access required" description="Only the workspace owner can view activity logs." /></Card>
        ) : (
          <>
            <Card style={styles.section}>
              <SectionHeader title="Filters" detail="Choose a filter, then apply an optional user email or ID." />
              <Text style={[styles.label, { color: theme.text }]}>Action</Text>
              <View style={styles.options}>
                {activityActions.map((value) => (
                  <Button key={value || 'all-actions'} label={value || 'All'} size="sm" variant={action === value ? 'primary' : 'secondary'} onPress={() => selectAction(value)} />
                ))}
              </View>
              <Text style={[styles.label, { color: theme.text }]}>Entity</Text>
              <View style={styles.options}>
                {activityEntities.map((value) => (
                  <Button key={value || 'all-entities'} label={value || 'All'} size="sm" variant={entity === value ? 'primary' : 'secondary'} onPress={() => selectEntity(value)} />
                ))}
              </View>
              <Input
                label="Performed by"
                value={performerInput}
                onChangeText={setPerformerInput}
                placeholder="User email or ID"
                autoCapitalize="none"
                onSubmitEditing={applyPerformer}
                returnKeyType="search"
              />
              <View style={styles.options}>
                <Button label="Apply user filter" size="sm" onPress={applyPerformer} />
                <Button label="Refresh" size="sm" variant="secondary" onPress={() => setReloadKey((value) => value + 1)} />
              </View>
            </Card>
            {loading ? <Card><LoadingState label="Loading activities..." /></Card> : error ? (
              <Card><FeedbackMessage message={error} variant="error" /><Button label="Try again" variant="secondary" onPress={() => setReloadKey((value) => value + 1)} /></Card>
            ) : !data || data.activities.length === 0 ? (
              <Card><EmptyState title="No activity found" description="Try changing the filters or check again later." /></Card>
            ) : (
              <>
                <SectionHeader title={`${data.count} activities`} detail={`Page ${page} of ${Math.max(1, data.totalPages)}`} />
                {data.activities.map((item) => {
                  const details = item.details || {};
                  const detailRows: [string, unknown][] = [
                    ['Product', details.productName],
                    ['Order', details.orderId],
                    ['Quantity', details.quantity],
                    ['Total quantity', details.totalQuantity],
                    ['Line items', details.itemCount],
                    ['Name', item.action === 'CREATE' ? details.name : undefined],
                    ['Initial stock', details.initialStock ?? details.stock],
                  ];
                  return (
                    <Card key={item.id} compact style={styles.activityCard}>
                      <View style={styles.row}>
                        <Text style={[styles.activityTitle, { color: theme.text }]}>{item.action === 'CREATE' && item.entity === 'product' ? 'Add Product' : item.action}</Text>
                        <Badge label={item.entity} variant="neutral" />
                      </View>
                      {detailRows.filter(([, value]) => value !== undefined && value !== null).map(([label, value]) => (
                        <Text key={label} style={[styles.detail, { color: theme.textSecondary }]}>{label}: <Text style={{ color: theme.text }}>{String(value)}</Text></Text>
                      ))}
                      {item.entity_id ? <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={1}>Record: {item.entity_id}</Text> : null}
                      <Text style={[styles.detail, { color: theme.textSecondary }]}>{dateTime(item.created_at)}</Text>
                      <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={1}>By: {item.performed_by_email || item.performed_by || 'Unknown'}</Text>
                      {item.ip_address && item.ip_address !== 'unknown' ? <Text style={[styles.detail, { color: theme.textSecondary }]}>IP: {item.ip_address}</Text> : null}
                      {typeof item.status_code === 'number' ? <Text style={[styles.detail, { color: item.status_code >= 400 ? theme.danger : theme.success }]}>Status: {item.status_code}</Text> : null}
                    </Card>
                  );
                })}
                <View style={styles.options}>
                  <Button label="Previous" variant="secondary" disabled={page <= 1 || loading} onPress={() => setPage((value) => Math.max(1, value - 1))} />
                  <Button label="Next" variant="secondary" disabled={page >= data.totalPages || loading} onPress={() => setPage((value) => value + 1)} />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

function SecurityScreen({ onBack }: { onBack?: () => void }) {
  const theme = useTheme();
  const { user } = useAuth();
  const { role, loading: roleLoading } = useTenantRole();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [factorLabels, setFactorLabels] = useState<string[]>([]);
  const [factorsLoading, setFactorsLoading] = useState(true);
  const [factorsError, setFactorsError] = useState<string | null>(null);
  const [method, setMethod] = useState<'totp' | 'phone'>('totp');
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [securityReload, setSecurityReload] = useState(0);

  useEffect(() => {
    let mounted = true;
    const loadFactors = async () => {
      setFactorsLoading(true);
      setFactorsError(null);
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        if (mounted) {
          setFactorLabels([
            ...data.totp.map((factor) => `${factor.friendly_name || 'Authenticator app'} · ${factor.status}`),
            ...data.phone.map((factor) => `SMS · ${factor.status}`),
          ]);
        }
      } catch (loadError) {
        if (mounted) setFactorsError(messageOf(loadError, 'Unable to load multi-factor settings.'));
      } finally {
        if (mounted) setFactorsLoading(false);
      }
    };
    const loadSessions = async () => {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const response = await callWebApi<{ sessions: UserSession[] }>('/api/auth/session');
        if (!Array.isArray(response.sessions)) throw new Error('The session service returned an invalid response.');
        if (mounted) setSessions(response.sessions);
      } catch (loadError) {
        if (mounted) setSessionsError(messageOf(loadError, 'Unable to load active sessions.'));
      } finally {
        if (mounted) setSessionsLoading(false);
      }
    };
    void loadFactors();
    void loadSessions();
    return () => { mounted = false; };
  }, [securityReload]);

  const startEnrollment = async () => {
    setMfaBusy(true);
    setMfaError(null);
    setMfaMessage(null);
    setChallenge(null);
    setQrCode(null);
    setSecret(null);
    try {
      let factorId: string;
      if (method === 'totp') {
        const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'MyInventory' });
        if (enrolled.error) throw enrolled.error;
        factorId = enrolled.data.id;
        setQrCode(enrolled.data.totp.qr_code);
        setSecret(enrolled.data.totp.secret);
      } else {
        if (!user?.phone) throw new Error('Add and verify a phone number before enabling SMS MFA.');
        const enrolled = await supabase.auth.mfa.enroll({ factorType: 'phone', phone: user.phone, friendlyName: 'MyInventory' });
        if (enrolled.error) throw enrolled.error;
        factorId = enrolled.data.id;
      }
      const sent = await supabase.auth.mfa.challenge(method === 'phone' ? { factorId, channel: 'sms' } : { factorId });
      if (sent.error) throw sent.error;
      setChallenge({ factorId, challengeId: sent.data.id, method, expiresAt: sent.data.expires_at * 1000 });
      setMfaMessage(method === 'phone'
        ? `A verification code was sent to ${user?.phone}.`
        : 'Enter the setup key in your authenticator app, then enter its six-digit code.');
    } catch (enrollError) {
      setMfaError(messageOf(enrollError, 'Unable to start MFA enrollment.'));
    } finally {
      setMfaBusy(false);
    }
  };

  const resendChallenge = async () => {
    if (!challenge || mfaBusy) return;
    setMfaBusy(true);
    setMfaError(null);
    try {
      const result = await supabase.auth.mfa.challenge(
        challenge.method === 'phone'
          ? { factorId: challenge.factorId, channel: 'sms' }
          : { factorId: challenge.factorId },
      );
      if (result.error) throw result.error;
      setChallenge((current) => current ? { ...current, challengeId: result.data.id, expiresAt: result.data.expires_at * 1000 } : current);
      setMfaMessage('A new verification challenge is ready.');
    } catch (challengeError) {
      setMfaError(messageOf(challengeError, 'Unable to send a new verification challenge.'));
    } finally {
      setMfaBusy(false);
    }
  };

  const verifyMfa = async () => {
    if (!challenge || mfaBusy) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setMfaError('Enter the six-digit verification code.');
      return;
    }
    if (Date.now() >= challenge.expiresAt) {
      setMfaError('This verification challenge expired. Send a new code and try again.');
      return;
    }
    setMfaBusy(true);
    setMfaError(null);
    setMfaMessage(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('Your sign-in session expired. Please sign in again.');
      const tokens = await callWebApi<{ access_token: string; refresh_token: string }>('/api/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({
          factor_id: challenge.factorId,
          challenge_id: challenge.challengeId,
          code: code.trim(),
          refresh_token: sessionData.session.refresh_token,
        }),
      });
      if (!tokens.access_token || !tokens.refresh_token) throw new Error('MFA verification returned an invalid session.');
      const { error: updateError } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (updateError) throw updateError;
      setChallenge(null);
      setCode('');
      setQrCode(null);
      setSecret(null);
      setMfaMessage('Multi-factor authentication is enabled.');
      setSecurityReload((value) => value + 1);
    } catch (verifyError) {
      setMfaError(messageOf(verifyError, 'Unable to verify the MFA code.'));
    } finally {
      setMfaBusy(false);
    }
  };

  const revokeSession = (session: UserSession) => {
    Alert.alert('Revoke session?', 'That device will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => { void (async () => {
          setRevokingId(session.session_id);
          setSessionsError(null);
          try {
            await callWebApi(`/api/auth/session?session_id=${encodeURIComponent(session.session_id)}`, { method: 'DELETE' });
            setSessions((current) => current.filter((item) => item.session_id !== session.session_id));
          } catch (revokeError) {
            setSessionsError(messageOf(revokeError, 'Unable to revoke this session.'));
          } finally {
            setRevokingId(null);
          }
        })(); },
      },
    ]);
  };

  if (roleLoading) return <AppShell title="Security" subtitle="Protect your account." onBack={onBack}><Card><LoadingState label="Checking workspace access..." /></Card></AppShell>;
  if (role === 'sales') return <AppShell title="Security" subtitle="Protect your account." onBack={onBack}><Card><EmptyState title="Access restricted" description="Use the web app to manage account security." /></Card></AppShell>;

  return (
    <AppShell title="Security" subtitle="Manage multi-factor authentication and active sessions." onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.section}>
          <SectionHeader title="Multi-factor authentication" detail="Use an authenticator app or SMS to add another sign-in check." />
          {factorsLoading ? <LoadingState label="Loading MFA settings..." /> : factorsError ? (
            <FeedbackMessage message={factorsError} variant="error" />
          ) : factorLabels.length ? factorLabels.map((label) => <Text key={label} style={[styles.detail, { color: theme.text }]}>{label}</Text>) : (
            <Text style={[styles.detail, { color: theme.textSecondary }]}>No MFA factors are enrolled.</Text>
          )}
          <View style={styles.options}>
            <Button label="Authenticator app" size="sm" variant={method === 'totp' ? 'primary' : 'secondary'} disabled={mfaBusy || Boolean(challenge)} onPress={() => setMethod('totp')} />
            <Button label="SMS" size="sm" variant={method === 'phone' ? 'primary' : 'secondary'} disabled={mfaBusy || Boolean(challenge)} onPress={() => setMethod('phone')} />
          </View>
          {method === 'phone' ? <Text style={[styles.detail, { color: theme.textSecondary }]}>SMS uses your verified account phone: {user?.phone || 'none set'}.</Text> : null}
          <Button label={mfaBusy ? 'Working...' : 'Start MFA enrollment'} variant="secondary" loading={mfaBusy} disabled={Boolean(challenge)} onPress={() => void startEnrollment()} />
          {qrCode ? (
            <View style={styles.setupPanel}>
              <Text style={[styles.label, { color: theme.text }]}>Authenticator QR code</Text>
              <Image source={{ uri: qrCode }} style={styles.qrCode} contentFit="contain" accessibilityLabel="Authenticator setup QR code" />
              <Text style={[styles.detail, { color: theme.textSecondary }]}>If the QR code cannot be scanned on this device, enter the setup key manually.</Text>
            </View>
          ) : null}
          {secret ? <Input label="Authenticator setup key" value={secret} editable={false} selectTextOnFocus autoCapitalize="none" /> : null}
          {challenge ? (
            <>
              <Input
                label="Six-digit verification code"
                value={code}
                onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setMfaError(null); }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                editable={!mfaBusy}
              />
              <View style={styles.options}>
                <Button label="Verify and enable" loading={mfaBusy} onPress={() => void verifyMfa()} />
                <Button label="Send new code" variant="secondary" disabled={mfaBusy} onPress={() => void resendChallenge()} />
              </View>
            </>
          ) : null}
          {mfaError ? <FeedbackMessage message={mfaError} variant="error" /> : null}
          {mfaMessage ? <FeedbackMessage message={mfaMessage} variant="success" /> : null}
          {factorsError ?           <Button label="Retry MFA settings" size="sm" variant="secondary" onPress={() => setSecurityReload((value) => value + 1)} /> : null}
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <SectionHeader title="Active sessions" detail="Review devices that have recently accessed your account." />
            <Button label="Refresh" size="sm" variant="ghost" onPress={() => setSecurityReload((value) => value + 1)} />
          </View>
          {sessionsLoading ? <LoadingState label="Loading active sessions..." /> : sessionsError ? (
            <><FeedbackMessage message={sessionsError} variant="error" /><Button label="Try again" size="sm" variant="secondary" onPress={() => setSecurityReload((value) => value + 1)} /></>
          ) : sessions.length === 0 ? (
            <EmptyState title="No tracked sessions" description="The web service has no active session records available." />
          ) : sessions.map((session) => (
            <View key={session.session_id} style={[styles.session, { borderColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>Session {session.session_id}</Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>Last active: {dateTime(session.last_activity)}</Text>
              {session.expires_at ? <Text style={[styles.detail, { color: theme.textSecondary }]}>Expires: {dateTime(session.expires_at)}</Text> : null}
              <Text style={[styles.detail, { color: theme.textSecondary }]}>IP: {session.ip_address || 'Unknown'}</Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={3}>Device: {session.user_agent || 'Unknown'}</Text>
              <Button label="Revoke session" size="sm" variant="danger" loading={revokingId === session.session_id} disabled={revokingId !== null && revokingId !== session.session_id} onPress={() => revokeSession(session)} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </AppShell>
  );
}

function PrivacyScreen({ onBack }: { onBack?: () => void }) {
  const theme = useTheme();
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const requestExport = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const request = await callWebApi<{ export_token: string; expires_at: string }>('/api/account/export-data', {
        method: 'POST',
        body: JSON.stringify({ format }),
      });
      if (!request.export_token) throw new Error('The export service did not return a download token.');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('Your sign-in session expired. Please sign in again.');
      if (!apiBaseUrl) throw new Error('The MyInventory API URL is not configured.');

      const response = await fetch(`${apiBaseUrl}/api/account/export-data?token=${encodeURIComponent(request.export_token)}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || `Unable to download export (HTTP ${response.status}).`);
      }
      const content = await response.text();
      if (!content) throw new Error('The export service returned an empty file.');
      const filename = `data-export-${new Date().toISOString().slice(0, 10)}-${Date.now()}.${format}`;
      if (Platform.OS === 'web') {
        const file = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const objectUrl = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        const file = new ExpoFile(Paths.cache, filename);
        file.create();
        await file.write(content);
        if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device. The export was saved to the app cache.');
        await Sharing.shareAsync(file.uri, {
          mimeType: format === 'json' ? 'application/json' : 'text/csv',
          dialogTitle: 'Share your data export',
          UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
        });
      }
      setMessage(`Your ${format.toUpperCase()} export was downloaded or shared.`);
    } catch (requestError) {
      setError(messageOf(requestError, 'Unable to export your data.'));
    } finally {
      setBusy(false);
    }
  };

  const requestDeletion = () => {
    Alert.alert(
      'Request account deletion?',
      'This starts an account deletion request. You will need to follow the confirmation instructions sent to your email; this does not immediately delete your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request deletion', style: 'destructive', onPress: () => { void (async () => {
          setBusy(true);
          setError(null);
          setMessage(null);
          try {
            const result = await callWebApi<{ message?: string }>('/api/account/delete-data', {
              method: 'POST',
              body: JSON.stringify({ confirm: true }),
            });
            setMessage(result.message || 'Deletion request created. Follow the confirmation instructions sent to your email.');
          } catch (requestError) {
            setError(messageOf(requestError, 'Unable to request account deletion.'));
          } finally {
            setBusy(false);
          }
        })(); } },
      ],
    );
  };

  return (
    <AppShell title="Privacy & data" subtitle="Export workspace data or request account deletion." onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <SectionHeader title="Download your data" detail="Request your workspace data as a JSON or CSV file." />
          <View style={styles.options}>
            {(['json', 'csv'] as const).map((value) => (
              <Button key={value} label={value.toUpperCase()} size="sm" variant={format === value ? 'primary' : 'secondary'} disabled={busy} onPress={() => setFormat(value)} />
            ))}
          </View>
          <Button label={`Request ${format.toUpperCase()} export`} loading={busy} disabled={busy} onPress={() => void requestExport()} />
        </Card>
        <Card style={styles.section}>
          <SectionHeader title="Account deletion" detail="Starts the protected email-confirmation workflow. Your account is not deleted until that confirmation is completed." />
          <Button label="Request account deletion" variant="danger" disabled={busy} onPress={requestDeletion} />
        </Card>
        {error ? <FeedbackMessage message={error} variant="error" /> : null}
        {message ? <FeedbackMessage message={message} variant="success" /> : null}
        <Text style={[styles.detail, { color: theme.textSecondary }]}>Exports may contain business and customer data. Store and share the downloaded file carefully.</Text>
      </ScrollView>
    </AppShell>
  );
}

export function AccountToolsScreen({ section, onBack }: { section: 'activity' | 'security' | 'privacy'; onBack?: () => void }) {
  if (section === 'activity') return <ActivityScreen onBack={onBack} />;
  if (section === 'security') return <SecurityScreen onBack={onBack} />;
  return <PrivacyScreen onBack={onBack} />;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingBottom: Spacing.five },
  section: { gap: Spacing.two },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  label: { ...Typography.label },
  detail: { ...Typography.caption },
  activityCard: { gap: Spacing.one },
  activityTitle: { ...Typography.label, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  setupPanel: { alignItems: 'center', gap: Spacing.two },
  qrCode: { width: 220, height: 220, resizeMode: 'contain' },
  session: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: Spacing.two, gap: Spacing.one },
});
