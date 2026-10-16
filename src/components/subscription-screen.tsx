import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, FeedbackMessage, Input, LoadingState, SectionHeader } from '@/components/ui';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { callWebApi } from '@/lib/web-api';

type SubscriptionPlan = 'basic' | 'pro' | 'unlimited';
type Subscription = { status: 'active' | 'pending' | 'inactive' | 'expired'; plan?: SubscriptionPlan; monthly_fee?: number; active_until?: string | null; next_billing_date?: string | null; message?: string };
type PlanDetails = { title: string; fee: number; products: string; users: string; detail: string };

const plans: Record<SubscriptionPlan, PlanDetails> = {
  basic: { title: 'Basic', fee: 5, products: 'Up to 1,000 products', users: 'Up to 3 users', detail: 'Essential inventory management for smaller businesses.' },
  pro: { title: 'Pro', fee: 7, products: 'Up to 5,000 products', users: 'Up to 10 users', detail: 'More capacity for growing teams.' },
  unlimited: { title: 'Unlimited', fee: 10, products: 'Unlimited products', users: 'Unlimited users', detail: 'Full access without listed product or user limits.' },
};
const durations = [1, 3, 6, 12];
const discounts: Record<number, number> = { 1: 0, 3: 10, 6: 15, 12: 20 };
const paymentWhatsApp = 'https://wa.me/252686859656';

function durationTotal(plan: SubscriptionPlan, months: number) {
  return Number((plans[plan].fee * months * (1 - discounts[months] / 100)).toFixed(2));
}
function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleDateString();
}

export function SubscriptionScreen({ onBack }: { onBack?: () => void } = {}) {
  const theme = useTheme();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('basic');
  const [duration, setDuration] = useState(1);
  const [payerName, setPayerName] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await callWebApi<Subscription>('/api/subscriptions');
        if (!mounted) return;
        setSubscription(data);
        if (data.plan && data.plan in plans) setSelectedPlan(data.plan);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load subscription status.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [reloadKey]);

  const active = subscription?.status === 'active';
  const pending = subscription?.status === 'pending';
  const selected = plans[selectedPlan];
  const total = durationTotal(selectedPlan, duration);
  const requestReady = payerName.trim() && paymentPhone.trim() && paymentEmail.trim() && businessName.trim();

  const submitRequest = async () => {
    if (active && !confirmUpgrade) {
      setConfirmUpgrade(true);
      return;
    }
    setRequesting(true);
    setError(null);
    setMessage(null);
    try {
      await callWebApi('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          plan: selectedPlan,
          subscription_duration_months: duration,
          monthly_fee: selected.fee,
          payer_name: payerName.trim(),
          payment_phone: paymentPhone.trim(),
          payment_email: paymentEmail.trim(),
          business_name: businessName.trim(),
          payment_reference: paymentReference.trim(),
          notes: notes.trim(),
        }),
      });
      setSubscription((current) => ({ ...current, status: 'pending', plan: selectedPlan, monthly_fee: selected.fee }));
      setMessage('Subscription request submitted. Waiting for admin approval.');
      setPayerName('');
      setPaymentPhone('');
      setPaymentEmail('');
      setBusinessName('');
      setPaymentReference('');
      setNotes('');
      setConfirmUpgrade(false);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit subscription request.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <AppShell title="Subscription" subtitle="Choose a plan and request activation.">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {onBack && <Button label="Back to More" variant="ghost" onPress={onBack} />}
        {loading ? <Card><LoadingState label="Loading subscription status..." /></Card> : error && !subscription ? (
          <Card><EmptyState title="Subscription unavailable" description={error} action={<Button label="Try again" variant="secondary" onPress={() => setReloadKey((value) => value + 1)} />} /></Card>
        ) : <>
          <Card compact style={styles.statusCard}>
            <View style={styles.statusTop}>
              <SectionHeader title="Subscription status" detail={subscription?.status === 'active' ? 'Your subscription is active.' : subscription?.status === 'pending' ? 'Your request is waiting for admin approval.' : 'No active subscription is currently recorded.'} />
              <Text style={[styles.status, { color: active ? theme.successForeground : pending ? theme.warningForeground : theme.textSecondary, backgroundColor: active ? theme.successSurface : pending ? theme.warningSurface : theme.surface }]}>{(subscription?.status || 'inactive').toUpperCase()}</Text>
            </View>
            {subscription && <View style={styles.statusDetails}>
              <Text style={[styles.body, { color: theme.text }]}>{plans[subscription.plan && subscription.plan in plans ? subscription.plan : 'basic'].title} · ${Number(subscription.monthly_fee ?? 5).toFixed(2)}/month</Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>Active until: {formatDate(subscription.active_until)}</Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>Next billing date: {formatDate(subscription.next_billing_date)}</Text>
            </View>}
          </Card>
          {error ? <FeedbackMessage message={error} /> : null}
          {message ? <FeedbackMessage message={message} variant="success" /> : null}
          {pending ? <Card compact><FeedbackMessage message="Your subscription request is pending. You can submit another request after an administrator reviews it." variant="info" /></Card> : <>
            {active && <FeedbackMessage message="An upgrade or extension request changes your current subscription to pending. Protected features may be unavailable until an administrator approves it." variant="info" />}
            <View style={styles.section}>
              <SectionHeader title={active ? 'Request an upgrade or extension' : 'Choose a plan'} detail="Plan requests are reviewed and activated by an administrator after payment verification." />
              {(['basic', 'pro', 'unlimited'] as SubscriptionPlan[]).map((plan) => {
                const item = plans[plan];
                const chosen = selectedPlan === plan;
                return <Button key={plan} label={`${item.title} · $${item.fee}/month`} variant={chosen ? 'primary' : 'secondary'} accessibilityState={{ selected: chosen }} onPress={() => { setSelectedPlan(plan); setConfirmUpgrade(false); }} />;
              })}
              <Card compact style={styles.planDetails}>
                <Text style={[styles.body, { color: theme.text }]}>{selected.products} · {selected.users}</Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>{selected.detail}</Text>
              </Card>
            </View>
            <View style={styles.section}>
              <SectionHeader title="Subscription duration" detail="Longer durations include a discount." />
              <View style={styles.durationRow}>{durations.map((months) => <Button key={months} label={months === 12 ? '1 year' : `${months} mo`} size="sm" variant={duration === months ? 'primary' : 'secondary'} accessibilityState={{ selected: duration === months }} onPress={() => { setDuration(months); setConfirmUpgrade(false); }} />)}</View>
              <Card compact style={styles.totalCard}>
                <Text style={[styles.body, { color: theme.text }]}>{duration === 12 ? '1 year' : `${duration} month${duration === 1 ? '' : 's'}`}{discounts[duration] > 0 ? ` · Save ${discounts[duration]}%` : ''}</Text>
                <Text style={[styles.total, { color: theme.text }]}>Total: ${total.toFixed(2)}</Text>
              </Card>
            </View>
            <Card compact style={styles.paymentCard}>
              <SectionHeader title="Manual payment" detail="This request does not charge you in the app. Contact the team, send payment, then submit the details below for verification." />
              <Text style={[styles.phone, { color: theme.primaryStrong }]}>+252 686 859 656</Text>
              <Button label="Message us on WhatsApp" variant="secondary" onPress={() => { void Linking.openURL(paymentWhatsApp).catch(() => setError('Could not open WhatsApp on this device.')); }} />
            </Card>
            <View style={styles.section}>
              <SectionHeader title="Payment details" detail="Required fields are marked by their labels." />
              <Input label="Payer name" value={payerName} onChangeText={setPayerName} placeholder="Name used to send payment" maxLength={100} editable={!requesting} />
              <Input label="Payment phone" value={paymentPhone} onChangeText={setPaymentPhone} placeholder="Phone used to send money" keyboardType="phone-pad" maxLength={40} editable={!requesting} />
              <Input label="Payment email" value={paymentEmail} onChangeText={setPaymentEmail} placeholder="Email used for payment" keyboardType="email-address" autoCapitalize="none" maxLength={120} editable={!requesting} />
              <Input label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="Business name" maxLength={120} editable={!requesting} />
              <Input label="Payment reference" value={paymentReference} onChangeText={setPaymentReference} placeholder="Transaction ID (optional)" maxLength={120} editable={!requesting} />
              <Input label="Additional notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline maxLength={500} editable={!requesting} />
              {confirmUpgrade && <FeedbackMessage message="Confirm to send this request. Your current access may pause while it is pending." variant="info" />}
              <View style={styles.actions}>
                {confirmUpgrade && <Button label="Not now" variant="secondary" disabled={requesting} onPress={() => setConfirmUpgrade(false)} />}
                <Button label={requesting ? 'Submitting...' : confirmUpgrade ? 'Confirm request' : active ? 'Request upgrade' : 'Request subscription'} loading={requesting} fullWidth={!confirmUpgrade} disabled={!requestReady || requesting} onPress={() => void submitRequest()} />
              </View>
            </View>
          </>}
        </>}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.lg, paddingBottom: Spacing.xxl },
  section: { gap: Spacing.md },
  statusCard: { gap: Spacing.md },
  statusTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  status: { ...Typography.caption, fontWeight: '700', borderRadius: Radius.sm, overflow: 'hidden', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  statusDetails: { gap: Spacing.xs },
  body: { ...Typography.label },
  meta: { ...Typography.helper },
  planDetails: { gap: Spacing.xs },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  totalCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  total: { ...Typography.sectionTitle },
  paymentCard: { gap: Spacing.md },
  phone: { ...Typography.sectionTitle },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
});
