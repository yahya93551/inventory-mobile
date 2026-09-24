import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, LoadingState } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDashboard } from '@/hooks/use-dashboard';

type MetricIcon = Exclude<SymbolViewProps['name'], string>;

function formatShortNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${value.toFixed(0)}`;
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No sales yet';
}

function MetricCard({ label, value, icon, tone = 'primary' }: { label: string; value: string | number; icon: MetricIcon; tone?: 'primary' | 'success' | 'warning' }) {
  const theme = useTheme();
  const color = tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : theme.primary;

  return (
    <Card compact style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}22` }]}>
        <SymbolView name={icon} tintColor={color} size={20} />
      </View>
      <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
    </Card>
  );
}

function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {detail && <Text style={[styles.sectionDetail, { color: theme.textSecondary }]}>{detail}</Text>}
    </View>
  );
}

export default function ProtectedHomeScreen() {
  const theme = useTheme();
  const { data, error, loading, retry } = useDashboard();

  if (!loading && data?.role === 'sales') return <Redirect href="/inventory" />;

  return (
    <AppShell title="Dashboard" subtitle="Inventory overview, cash flow, and sales activity.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Card><LoadingState label="Loading dashboard data..." /></Card>
        ) : error ? (
          <Card style={styles.errorCard}>
            <EmptyState title="Dashboard unavailable" description={error} action={<Button label="Try again" variant="secondary" onPress={retry} />} />
          </Card>
        ) : data ? (
          <>
            <View>
              <SectionHeading title="Sales overview" detail="Live results from your workspace" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
                <MetricCard label="Net Revenue" value={formatShortNumber(data.netRevenue)} icon={{ ios: 'dollarsign.circle', android: 'attach_money', web: 'attach_money' }} />
                <MetricCard label="Total Sales" value={data.totalSales} icon={{ ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' }} />
                <MetricCard label="Average Sale" value={formatShortNumber(data.averageSale)} icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }} tone="success" />
                <MetricCard label="Sales This Month" value={data.salesThisMonth} icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} />
              </ScrollView>
            </View>

            <Card>
              <SectionHeading title="Revenue trend" detail={`${data.trend.length} day${data.trend.length === 1 ? '' : 's'} in the latest sales window`} />
              {data.trend.length === 0 ? (
                <EmptyState title="No sales trend yet" description="Record sales to see revenue movement here." />
              ) : (
                <View style={styles.chart}>
                  {data.trend.slice(-7).map((point) => {
                    const maxValue = Math.max(...data.trend.slice(-7).map((item) => Math.abs(item.total)), 1);
                    const height = Math.max(8, (Math.abs(point.total) / maxValue) * 112);
                    const barColor = point.total < 0 ? theme.danger : theme.primary;
                    return (
                      <View key={point.date} style={styles.barColumn}>
                        <View style={styles.barTrack}><View style={[styles.bar, { height, backgroundColor: barColor }]} /></View>
                        <Text style={[styles.axisLabel, { color: theme.textMuted }]}>{point.date.slice(5)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            <View>
              <SectionHeading title="Inventory value" detail="Based on the dashboard product window" />
              <View style={styles.summaryGrid}>
                {data.costPriceVisible && <MetricCard label="Inventory Cost" value={formatShortNumber(data.totalCost)} icon={{ ios: 'banknote', android: 'payments', web: 'payments' }} />}
                {data.priceVisible && <MetricCard label="Sell Value" value={formatShortNumber(data.totalSellValue)} icon={{ ios: 'tag', android: 'sell', web: 'sell' }} />}
                {data.costPriceVisible && data.priceVisible && <MetricCard label="Potential Profit" value={formatShortNumber(data.potentialProfit)} icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }} tone="success" />}
                <MetricCard label="Last Sale" value={formatDate(data.lastSaleDate)} icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }} tone="warning" />
              </View>
            </View>

            {data.ownerMetrics && (
              <Card compact>
                <SectionHeading title="Owner snapshot" detail={data.businessType === 'warehouse' ? 'Warehouse allocations and outstanding balances' : 'Outstanding balances'} />
                {data.businessType === 'warehouse' && <SummaryRow label="Taken, not sold" value={String(data.ownerMetrics.takenNotSoldTotal)} />}
                <SummaryRow label="Unpaid debts" value={formatShortNumber(data.ownerMetrics.unpaidDebtsTotal)} />
              </Card>
            )}

            <Card>
              <View style={styles.sectionHeaderRow}>
                <SectionHeading title="Recent sales" detail={`${Math.min(5, data.sales.length)} latest`} />
                <Badge label="Live" variant="primary" />
              </View>
              {data.sales.length === 0 ? (
                <EmptyState title="No sales recorded yet" description="Recent transactions will appear here." />
              ) : (
                <View style={styles.salesList}>
                  {data.sales.slice(0, 5).map((sale) => (
                    <View key={sale.id} style={[styles.saleRow, { borderBottomColor: theme.border }]}>
                      <View style={styles.saleCopy}>
                        <Text style={[styles.saleName, { color: theme.text }]} numberOfLines={1}>{sale.productName}</Text>
                        <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>{sale.quantity ?? 0} {sale.quantity_unit || sale.quantity_unit_name || 'unit'} · {formatDate(sale.date)}</Text>
                      </View>
                      <Text style={[styles.saleAmount, { color: sale.type === 'return' ? theme.danger : theme.primary }]}>{sale.type === 'return' ? '-' : ''}{formatShortNumber(Number(sale.total || 0))}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            <Card compact>
              <SectionHeading title="Top product" detail="Highest signed revenue in the latest sales window" />
              {data.topProduct ? (
                <View style={styles.topProduct}>
                  <Text style={[styles.topProductName, { color: theme.text }]} numberOfLines={1}>{data.topProduct.name}</Text>
                  <Text style={[styles.topProductValue, { color: theme.success }]}>{formatShortNumber(data.topProduct.revenue)}</Text>
                  {data.topProduct.share > 0 && <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>{data.topProduct.share.toFixed(0)}% of net revenue</Text>}
                </View>
              ) : <EmptyState title="No top product yet" description="Record sales to see your top revenue driver." />}
            </Card>

            <View style={styles.categoryCard}>
              <MetricCard label="Total Categories" value={data.categoryCount} icon={{ ios: 'folder', android: 'category', web: 'category' }} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={styles.summaryRow}><Text style={[styles.body, { color: theme.textSecondary }]}>{label}</Text><Text style={[styles.body, { color: theme.text, fontWeight: '700' }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, paddingBottom: Spacing.five },
  errorCard: { minHeight: 240 },
  horizontalCards: { gap: Spacing.two, paddingTop: Spacing.two, paddingRight: Spacing.four },
  metricCard: { width: 148, minHeight: 142, gap: Spacing.one },
  metricIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  metricLabel: { ...Typography.caption },
  metricValue: { ...Typography.metric },
  sectionHeading: { gap: Spacing.half },
  sectionTitle: { ...Typography.sectionTitle },
  sectionDetail: { ...Typography.caption },
  chart: { height: 164, paddingTop: Spacing.three, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: Spacing.two },
  barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.one },
  barTrack: { height: 120, width: 20, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 14, borderRadius: 7 },
  axisLabel: { fontSize: 10, lineHeight: 14 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingTop: Spacing.two },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { ...Typography.body },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  salesList: { marginTop: Spacing.three },
  saleRow: { minHeight: 64, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  saleCopy: { flex: 1, gap: Spacing.half },
  saleName: { ...Typography.label },
  saleMeta: { ...Typography.caption },
  saleAmount: { ...Typography.label },
  topProduct: { marginTop: Spacing.three, gap: Spacing.one },
  topProductName: { ...Typography.sectionTitle },
  topProductValue: { ...Typography.metric },
  categoryCard: { alignItems: 'flex-start' },
});