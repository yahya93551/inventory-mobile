import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, FeedbackMessage, LoadingState, SectionHeader } from '@/components/ui';
import { Radius, Spacing, Typography } from '@/constants/theme';
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

function MetricCard({ label, value, icon, tone = 'primary', featured = false }: { label: string; value: string | number; icon: MetricIcon; tone?: 'primary' | 'success' | 'warning'; featured?: boolean }) {
  const theme = useTheme();
  const color = tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : theme.primary;
  const iconSurface = tone === 'success' ? theme.successSurface : tone === 'warning' ? theme.warningSurface : theme.primarySurface;

  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Card compact style={[styles.metricCard, featured && styles.featuredMetric]}>
        {featured ? (
          <View style={styles.featuredContent}>
            <View style={[styles.metricIcon, styles.featuredIcon, { backgroundColor: iconSurface }]}>
              <SymbolView name={icon} tintColor={color} size={24} />
            </View>
            <View style={styles.featuredCopy}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
              <Text style={[styles.featuredValue, { color: theme.text }]}>{value}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.metricIcon, { backgroundColor: iconSurface }]}>
              <SymbolView name={icon} tintColor={color} size={20} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
          </>
        )}
      </Card>
    </View>
  );
}

export default function ProtectedHomeScreen() {
  const theme = useTheme();
  const { data, error, loading, retry } = useDashboard();
  const chartPoints = data?.trend.slice(-7) ?? [];
  const chartMaximum = Math.max(1, ...chartPoints.map((point) => Math.abs(point.total)));
  const chartAccessibleSummary = chartPoints.length
    ? `Daily net revenue, latest ${chartPoints.length} dates: ${chartPoints.map((point) => `${point.date}, ${formatShortNumber(point.total)}`).join('; ')}`
    : 'No daily revenue values available.';
  const latestChartPoint = chartPoints[chartPoints.length - 1];

  if (!loading && data?.role === 'sales') return <Redirect href="/inventory" />;

  return (
    <AppShell title="Dashboard" subtitle="Inventory overview, cash flow, and sales activity.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.statePanel}><LoadingState label="Loading dashboard data..." /></View>
        ) : error ? (
          <View style={styles.statePanel}>
            <SectionHeader title="Dashboard unavailable" />
            <FeedbackMessage message={error} variant="error" />
            <Button label="Try again" variant="secondary" onPress={retry} />
          </View>
        ) : data ? (
          <View style={styles.sections}>
            <View style={styles.metricSection}>
              <SectionHeader title="Sales overview" detail="Sales figures use the latest up to 100 sales records." />
              <MetricCard label="Net revenue" value={formatShortNumber(data.netRevenue)} icon={{ ios: 'dollarsign.circle', android: 'attach_money', web: 'attach_money' }} featured />
              <View style={styles.carouselHint}>
                <Text style={[styles.hintText, { color: theme.textSecondary }]}>Swipe to view 3 more measures</Text>
                <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={theme.textSecondary} size={16} />
              </View>
              <ScrollView
                horizontal
                accessibilityLabel="More sales metrics"
                accessibilityHint="Swipe horizontally to view total sales, average sale, and sales this month"
                showsHorizontalScrollIndicator
                contentContainerStyle={styles.horizontalCards}>
                <MetricCard label="Sales recorded" value={data.totalSales} icon={{ ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' }} />
                <MetricCard label="Average sale" value={formatShortNumber(data.averageSale)} icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }} tone="success" />
                <MetricCard label="Sales this month" value={data.salesThisMonth} icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} />
              </ScrollView>
            </View>

            <Card>
              <SectionHeader title="Revenue trend" detail={`Daily net revenue · ${chartPoints.length} latest dates shown`} />
              {chartPoints.length === 0 ? (
                <EmptyState title="No sales trend yet" description="Record sales to see revenue movement here." />
              ) : (
                <>
                  <View accessible accessibilityLabel={chartAccessibleSummary} style={styles.chart}>
                    {chartPoints.map((point) => {
                      const height = Math.max(8, (Math.abs(point.total) / chartMaximum) * 112);
                      const barColor = point.total < 0 ? theme.danger : theme.primary;
                      return (
                        <View key={point.date} accessible accessibilityLabel={`${point.date}: ${formatShortNumber(point.total)} net revenue`} style={styles.barColumn}>
                          <View style={styles.barTrack}><View style={[styles.bar, { height, backgroundColor: barColor }]} /></View>
                          <Text style={[styles.axisLabel, { color: theme.textMuted }]}>{point.date.slice(5)}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={[styles.chartSummary, { color: theme.text }]}>
                    {latestChartPoint ? `Latest shown: ${latestChartPoint.date} · ${formatShortNumber(latestChartPoint.total)} net revenue` : ''}
                  </Text>
                  <Text style={[styles.chartKey, { color: theme.textSecondary }]}>Negative totals are shown in red and represent net returns.</Text>
                </>
              )}
            </Card>

            <View style={styles.section}>
              <SectionHeader title="Inventory value" detail="Based on current product inventory." />
              <View style={styles.summaryGrid}>
                {data.costPriceVisible && <MetricCard label="Inventory cost" value={formatShortNumber(data.totalCost)} icon={{ ios: 'banknote', android: 'payments', web: 'payments' }} />}
                {data.priceVisible && <MetricCard label="Sell value" value={formatShortNumber(data.totalSellValue)} icon={{ ios: 'tag', android: 'sell', web: 'sell' }} />}
                {data.costPriceVisible && data.priceVisible && <MetricCard label="Potential profit" value={formatShortNumber(data.potentialProfit)} icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }} tone="success" />}
                <MetricCard label="Last sale" value={formatDate(data.lastSaleDate)} icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }} tone="warning" />
              </View>
            </View>

            {data.ownerMetrics && (
              <Card compact>
                <SectionHeader title="Owner snapshot" detail={data.businessType === 'warehouse' ? 'Warehouse allocations and outstanding balances' : 'Outstanding balances'} />
                {data.businessType === 'warehouse' && <SummaryRow label="Taken, not sold" detail={data.ownerMetrics.available ? `${data.ownerMetrics.takenNotSoldCount} records` : 'Unable to load'} value={data.ownerMetrics.available ? String(data.ownerMetrics.takenNotSoldTotal) : 'Unavailable'} />}
                <SummaryRow label="Unpaid debts" detail={data.ownerMetrics.available ? `${data.ownerMetrics.unpaidDebtsCount} records` : 'Unable to load'} value={data.ownerMetrics.available ? formatShortNumber(data.ownerMetrics.unpaidDebtsTotal) : 'Unavailable'} />
              </Card>
            )}

            <Card>
              <SectionHeader title="Recent sales" detail={`${Math.min(5, data.sales.length)} latest from the dashboard sales window`} />
              {data.sales.length === 0 ? (
                <EmptyState title="No sales recorded yet" description="Recent transactions will appear here." />
              ) : (
                <View style={styles.salesList}>
                  {data.sales.slice(0, 5).map((sale) => {
                    const isReturn = sale.type === 'return';
                    return (
                      <View key={sale.id} style={[styles.saleRow, { borderBottomColor: theme.border }]}>
                        <View style={styles.saleCopy}>
                          <Text style={[styles.saleName, { color: theme.text }]} numberOfLines={1}>{sale.productName}</Text>
                          {sale.customer_name ? <Text style={[styles.saleMeta, { color: theme.textSecondary }]} numberOfLines={1}>{sale.customer_name}</Text> : null}
                          <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>{sale.quantity ?? 0} {sale.quantity_unit || 'unit'} · {formatDate(sale.date)}</Text>
                        </View>
                        <View style={styles.saleResult}>
                          <Text style={[styles.saleAmount, { color: isReturn ? theme.danger : theme.primary }]}>{isReturn ? '-' : ''}{formatShortNumber(Number(sale.total || 0))}</Text>
                          <Badge label={isReturn ? 'Return' : 'Sale'} variant={isReturn ? 'danger' : 'success'} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            <Card compact>
              <SectionHeader title="Top product" detail="Highest signed revenue in the latest sales window" />
              {data.topProduct ? (
                <View style={styles.topProduct}>
                  <Text style={[styles.valueLabel, { color: theme.textSecondary }]}>Product</Text>
                  <Text style={[styles.topProductName, { color: theme.text }]} numberOfLines={2}>{data.topProduct.name}</Text>
                  <Text style={[styles.valueLabel, { color: theme.textSecondary }]}>Revenue</Text>
                  <Text style={[styles.topProductValue, { color: theme.success }]}>{formatShortNumber(data.topProduct.revenue)}</Text>
                  {data.topProduct.share > 0 && <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>{data.topProduct.share.toFixed(0)}% of net revenue</Text>}
                </View>
              ) : <EmptyState title="No top product yet" description="Record sales to see your top revenue driver." />}
            </Card>

            <View style={styles.section}>
              <SectionHeader title="Catalog" detail="Current product and category counts" />
              <View style={styles.summaryGrid}>
                <MetricCard label="Products" value={data.totalProducts} icon={{ ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' }} />
                <MetricCard label="Categories" value={data.categoryCount} icon={{ ios: 'folder', android: 'category', web: 'category' }} />
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

function SummaryRow({ label, detail, value }: { label: string; detail?: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.summaryRow, { borderBottomColor: theme.border }]}>
      <View style={styles.summaryCopy}>
        <Text style={[styles.body, { color: theme.text }]}>{label}</Text>
        {detail ? <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>{detail}</Text> : null}
      </View>
      <Text style={[styles.body, styles.summaryValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.xl, paddingBottom: Spacing.xxl },
  statePanel: { flex: 1, justifyContent: 'center', gap: Spacing.lg, paddingVertical: Spacing.xl },
  sections: { gap: Spacing.xl },
  section: { gap: Spacing.md },
  metricSection: { gap: Spacing.md },
  horizontalCards: { gap: Spacing.sm, paddingRight: Spacing.xl, paddingBottom: Spacing.xs },
  carouselHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.xs },
  hintText: { ...Typography.caption },
  metricCard: { width: 148, minHeight: 132, gap: Spacing.sm },
  featuredMetric: { width: '100%', minHeight: 112, justifyContent: 'center' },
  featuredContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  featuredIcon: { width: 48, height: 48, borderRadius: Radius.md, marginBottom: 0 },
  featuredCopy: { flex: 1, gap: Spacing.xs },
  metricIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  metricLabel: { ...Typography.caption },
  metricValue: { ...Typography.metric },
  featuredValue: { ...Typography.screenTitle },
  chart: { minHeight: 164, paddingTop: Spacing.lg, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: Spacing.xs },
  barColumn: { flex: 1, height: 164, alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.xs },
  barTrack: { height: 120, width: 20, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 14, borderRadius: Radius.sm },
  axisLabel: { ...Typography.caption },
  chartSummary: { ...Typography.label, marginTop: Spacing.md },
  chartKey: { ...Typography.caption, marginTop: Spacing.xs },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingTop: Spacing.sm },
  summaryRow: { minHeight: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryCopy: { flex: 1, gap: Spacing.xxs },
  summaryValue: { fontWeight: '700' },
  body: { ...Typography.body },
  salesList: { marginTop: Spacing.md },
  saleRow: { minHeight: 76, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  saleCopy: { flex: 1, gap: Spacing.xxs },
  saleName: { ...Typography.label },
  saleMeta: { ...Typography.caption },
  saleResult: { alignItems: 'flex-end', gap: Spacing.xs },
  saleAmount: { ...Typography.label },
  topProduct: { marginTop: Spacing.md, gap: Spacing.xs },
  valueLabel: { ...Typography.caption },
  topProductName: { ...Typography.sectionTitle },
  topProductValue: { ...Typography.metric },
});