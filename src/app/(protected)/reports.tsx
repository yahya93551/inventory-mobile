import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, LoadingState } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReports, type ProductMetric, type ReportFilter } from '@/hooks/use-reports';

function money(value: number) { return `$${value.toFixed(2)}`; }
function metricQuantity(metric: ProductMetric, field: 'started' | 'stock_loaded' | 'sold' | 'returned' | 'remaining') {
  const value = metric[field];
  if (value === null || value === undefined) return '-';
  const unit = field === 'sold' || field === 'returned' ? metric.sold_unit_mode : undefined;
  if (metric.base_unit && metric.converted_unit && metric.conversion_rate && unit !== 'converted') return `${Number(value).toFixed(2)} ${metric.base_unit}`;
  return `${Number(value).toFixed(2)} ${unit === 'converted' ? metric.converted_unit : metric.base_unit || ''}`.trim();
}

function Stat({ label, value, tone = 'primary' }: { label: string; value: string; tone?: 'primary' | 'success' | 'warning' }) {
  const theme = useTheme();
  const color = tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : theme.primary;
  return <Card compact style={styles.stat}><Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text><Text style={[styles.statValue, { color }]}>{value}</Text></Card>;
}

export default function ReportsScreen() {
  const theme = useTheme();
  const state = useReports();
  if (!state.loading && state.data?.role === 'sales') return <Redirect href="/inventory" />;
  const data = state.data;
  const filters: { value: ReportFilter; label: string }[] = [{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'all', label: 'All time' }];
  return <AppShell title="Reports" subtitle="Sales movement and product performance."><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.filterRow}>{filters.map((filter) => <Button key={filter.value} label={filter.label} size="sm" variant={state.filter === filter.value ? 'primary' : 'secondary'} onPress={() => state.setFilter(filter.value)} />)}<Button label="Refresh" size="sm" variant="ghost" onPress={state.refresh} /></View>{state.loading ? <Card><LoadingState label="Loading reports..." /></Card> : state.error ? <Card><EmptyState title="Reports unavailable" description={state.error} action={<Button label="Try again" variant="secondary" onPress={state.refresh} />} /></Card> : !data || data.orders === 0 ? <Card><EmptyState title="No report data" description="There are no sales in the selected date range." /></Card> : <><View style={styles.grid}><Stat label="Total revenue" value={money(data.revenue)} tone="success" /><Stat label="Orders" value={String(data.orders)} /><Stat label="Average order" value={money(data.average)} tone="warning" /><Stat label="Top product" value={data.topProduct || 'No sales'} /></View><Card><Text style={[styles.sectionTitle, { color: theme.text }]}>Sales per user</Text>{data.perUser.map((item) => <View key={item.name} style={[styles.row, { borderBottomColor: theme.border }]}><Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text><Text style={[styles.rowValue, { color: theme.success }]}>{money(item.total)}</Text></View>)}</Card><Card><Text style={[styles.sectionTitle, { color: theme.text }]}>Sales per product</Text>{data.perProduct.map((item) => <View key={item.name} style={[styles.row, { borderBottomColor: theme.border }]}><Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text><Text style={[styles.rowValue, { color: theme.text }]}>{item.quantity} {item.unit || 'units'}</Text></View>)}</Card><Card><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>Product inventory metrics</Text><Badge label={`${data.metrics.length} products`} variant="neutral" /></View>{data.metrics.slice(0, 20).map((metric) => <View key={metric.product_id} style={[styles.metricBlock, { borderBottomColor: theme.border }]}><Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{metric.product_name}</Text><View style={styles.metricGrid}><Text style={[styles.metricText, { color: theme.textSecondary }]}>Started: <Text style={{ color: theme.text }}>{metricQuantity(metric, 'started')}</Text></Text><Text style={[styles.metricText, { color: theme.textSecondary }]}>Added: <Text style={{ color: theme.text }}>{metricQuantity(metric, 'stock_loaded')}</Text></Text><Text style={[styles.metricText, { color: theme.textSecondary }]}>Sold: <Text style={{ color: theme.text }}>{metricQuantity(metric, 'sold')}</Text></Text><Text style={[styles.metricText, { color: theme.textSecondary }]}>Returned: <Text style={{ color: theme.text }}>{metricQuantity(metric, 'returned')}</Text></Text><Text style={[styles.metricText, { color: theme.textSecondary }]}>Remaining: <Text style={{ color: theme.text }}>{metricQuantity(metric, 'remaining')}</Text></Text></View></View>)}</Card><Card><Text style={[styles.sectionTitle, { color: theme.text }]}>Recent sales</Text>{data.sales.slice(0, 10).map((sale) => <View key={sale.id} style={[styles.row, { borderBottomColor: theme.border }]}><View style={styles.rowName}><Text style={{ color: theme.text }} numberOfLines={1}>{sale.product_name || 'Unknown'}</Text><Text style={[styles.small, { color: theme.textSecondary }]}>{sale.quantity || 0} {sale.quantity_unit || 'unit'} · {sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'No date'}</Text></View><Text style={[styles.rowValue, { color: theme.success }]}>{money(Number(sale.total || 0))}</Text></View>)}</Card></>}</ScrollView></AppShell>;
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingBottom: Spacing.five }, filterRow: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, stat: { width: '47%', minHeight: 94, gap: Spacing.one }, statLabel: { ...Typography.caption }, statValue: { ...Typography.metric, fontSize: 21 }, sectionTitle: { ...Typography.sectionTitle, fontSize: 18, marginBottom: Spacing.two }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }, row: { minHeight: 54, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }, rowName: { flex: 1, ...Typography.label }, rowValue: { ...Typography.label }, small: { ...Typography.caption, marginTop: Spacing.half }, metricBlock: { paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.one }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }, metricText: { width: '48%', ...Typography.caption },
});
