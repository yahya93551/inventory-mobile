import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, FeedbackMessage, LoadingState, SectionHeader } from '@/components/ui';
import { ControlHeights, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { callWebApi } from '@/lib/web-api';

type SubscriptionPlan = 'basic' | 'pro' | 'unlimited';
type Subscription = { status: 'active' | 'pending' | 'inactive' | 'expired'; plan?: SubscriptionPlan; monthly_fee?: number; active_until?: string | null; next_billing_date?: string | null; message?: string };
type CheckoutResult = {
  referenceId?: string;
  status?: 'pending' | 'succeeded' | 'failed' | 'sandbox' | string;
  providerState?: string | null;
  responseCode?: string | null;
  requestSent?: boolean;
  message?: string;
};
type PlanDetails = { title: string; fee: number; products: string; users: string; detail: string };

const plans: Record<SubscriptionPlan, PlanDetails> = {
  basic: { title: 'Basic', fee: 5, products: 'Up to 1,000 products', users: 'Up to 3 users', detail: 'Essential inventory management for smaller businesses.' },
  pro: { title: 'Pro', fee: 7, products: 'Up to 5,000 products', users: 'Up to 10 users', detail: 'More capacity for growing teams.' },
  unlimited: { title: 'Unlimited', fee: 10, products: 'Unlimited products', users: 'Unlimited users', detail: 'Full access without listed product or user limits.' },
};
const durations = [1, 3, 6, 12];
const discounts: Record<number, number> = { 1: 0, 3: 10, 6: 15, 12: 20 };

function durationTotal(plan: SubscriptionPlan, months: number) {
  return Number((plans[plan].fee * months * (1 - discounts[months] / 100)).toFixed(2));
}
function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleDateString();
}
function normalizeAccountNo(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 20);
  const withoutPrefix = digits.startsWith('252') ? digits.slice(3) : digits;
  return `252${withoutPrefix}`.slice(0, 20);
}

export function SubscriptionScreen({ onBack }: { onBack?: () => void } = {}) {
  const theme = useTheme();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('basic');
  const [duration, setDuration] = useState(1);
  const [accountNo, setAccountNo] = useState('252');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<string | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) setError(null);
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
    const refreshInterval = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, 30_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      mounted = false;
      clearInterval(refreshInterval);
      appStateSubscription.remove();
    };
  }, [reloadKey]);

  const active = subscription?.status === 'active';
  const pending = subscription?.status === 'pending';
  const selected = plans[selectedPlan];
  const total = durationTotal(selectedPlan, duration);
  const requestReady = /^[1-9][0-9]{9,19}$/.test(accountNo);

  const submitRequest = async () => {
    if (active && !confirmUpgrade) {
      setConfirmUpgrade(true);
      return;
    }
    setRequesting(true);
    setError(null);
    setMessage(null);
    setCheckoutResult(null);
    try {
      const result = await callWebApi<CheckoutResult>('/api/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan: selectedPlan,
          durationMonths: duration,
          accountNo,
        }),
      });

      const status = result.status ?? 'pending';
      const providerState = result.providerState ?? null;
      const nextMessage = status === 'succeeded'
        ? 'EVC Plus confirmed your payment. Your subscription is active.'
        : status === 'failed'
          ? providerState === 'insufficient_balance'
            ? 'Not enough balance in your EVC Plus wallet. Add funds and try again.'
            : providerState === 'user_rejected'
              ? 'You rejected the EVC Plus payment request. No subscription was activated.'
              : 'Your payment was rejected. Please try again. No subscription was activated.'
          : 'Checkout is awaiting your EVC Plus response. Approve or reject the request on your phone. Do not retry while it is pending.';

      setMessage(nextMessage);
      setCheckoutResult(status === 'pending'
        ? 'Awaiting confirmation from EVC Plus.'
        : status === 'succeeded'
          ? 'Payment confirmed; subscription activated.'
          : `Payment status: ${status}; provider state: ${providerState ?? 'unknown'}; response code: ${result.responseCode ?? 'not returned'}.`);
      setAccountNo('252');
      setConfirmUpgrade(false);
      if (status === 'succeeded') {
        setReloadKey((value) => value + 1);
      }
    } catch (requestError) {
      const userMessage = requestError instanceof Error ? requestError.message : 'Unable to submit subscription request.';
      setMessage(userMessage);
      setCheckoutResult('Checkout request failed.');
      setError(userMessage);
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
          {message ? <FeedbackMessage message={message} variant={message.toLowerCase().includes('success') || message.toLowerCase().includes('active') ? 'success' : 'info'} /> : null}
          {checkoutResult ? <Card compact><FeedbackMessage message={checkoutResult} variant="info" /></Card> : null}
          {pending ? <Card compact><FeedbackMessage message="Your subscription request is pending. You can submit another request after an administrator reviews it." variant="info" /></Card> : <>
            {active && <FeedbackMessage message="An upgrade or extension request changes your current subscription to pending. Protected features may be unavailable until an administrator approves it." variant="info" />}
            <View style={styles.section}>
              <SectionHeader title={active ? 'Request an upgrade or extension' : 'Choose a plan'} detail="Secure checkout uses the same direct EVC Plus payment flow as the web app." />
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
            <View style={styles.section}>
              <SectionHeader title="EVC Plus payment" detail="Enter the wallet number to start the checkout flow used by the web app." />
              <View style={styles.accountRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Wallet number</Text>
                <Text style={[styles.accountPreview, { color: theme.text }]}>{accountNo}</Text>
              </View>
              <Button label="Clear number" variant="secondary" onPress={() => setAccountNo('252')} />
              <Button label="Use this wallet" variant="primary" disabled={!requestReady || requesting} loading={requesting} onPress={() => void submitRequest()} />
            </View>
            <View style={styles.section}>
              <SectionHeader title="Wallet number" detail="No + sign. The prefix 252 is added automatically." />
              <Text style={[styles.helper, { color: theme.textSecondary }]}>Example: 252 and then your number, like 252123456789</Text>
              <View style={styles.inputWrap}>
                <Text style={[styles.prefix, { color: theme.textSecondary }]}>252</Text>
                <Text style={[styles.input, { color: theme.text, borderColor: theme.border }]}>{accountNo.slice(3)}</Text>
              </View>
              <Button label="Add digits" variant="secondary" onPress={() => {
                const next = normalizeAccountNo(`${accountNo}1`);
                setAccountNo(next);
              }} />
              <Button label="Remove last digit" variant="ghost" onPress={() => {
                setAccountNo((current) => normalizeAccountNo(current.slice(0, -1) || '252'));
              }} />
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
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  label: { ...Typography.label },
  accountPreview: { ...Typography.sectionTitle },
  helper: { ...Typography.helper },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, minHeight: ControlHeights.standard },
  prefix: { ...Typography.label, marginRight: Spacing.sm },
  input: { ...Typography.label, flex: 1, minHeight: ControlHeights.standard, justifyContent: 'center' },
});
