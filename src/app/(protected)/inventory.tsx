import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, Input, LoadingState } from '@/components/ui';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useInventory, type Product, type ProductInput, type StockFilter } from '@/hooks/use-inventory';

type FormState = { name: string; category: string; cost: string; price: string; stock: string; base: string; converted: string; rate: string };
const emptyForm: FormState = { name: '', category: '', cost: '', price: '', stock: '', base: '', converted: '', rate: '' };
const filters: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'in', label: 'In stock' }, { value: 'low', label: 'Low' }, { value: 'critical', label: 'Critical' }, { value: 'out', label: 'Out' },
];

function money(value: number | null | undefined) { return `$${Number(value || 0).toFixed(2)}`; }
function stockText(product: Product) {
  const stock = Number(product.stock || 0);
  const base = product.base_unit?.trim();
  const converted = product.converted_unit?.trim();
  const rate = Number(product.conversion_rate || 0);
  const remainder = Number(product.stock_remainder || 0);
  if (base && converted && rate > 0) return remainder ? `${stock} ${base} + ${remainder} ${converted} (${stock * rate + remainder} ${converted})` : `${stock} ${base} (${stock * rate} ${converted})`;
  return `${stock}${base ? ` ${base}` : ''}`;
}
function stockBadge(product: Product) {
  const stock = Number(product.stock || 0);
  return { label: stock === 0 ? 'Out' : stock <= 5 ? 'Critical' : stock < 20 ? 'Low' : 'In stock', variant: stock === 0 ? 'danger' as const : stock <= 5 ? 'warning' as const : 'success' as const };
}

function ProductCard({ product, showCost, onPress }: { product: Product; showCost: boolean; onPress: () => void }) {
  const theme = useTheme();
  const status = stockBadge(product);
  return <Card compact interactive onPress={onPress} style={styles.card}><View style={styles.cardTop}>{product.image_url ? <Image source={{ uri: product.image_url }} style={styles.image} /> : <View style={[styles.image, styles.imageFallback, { backgroundColor: theme.surface }]}><Text style={{ color: theme.textMuted }}>No image</Text></View>}<View style={styles.copy}><Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{product.name}</Text><Text style={[styles.category, { color: theme.textSecondary }]}>{product.category || 'Uncategorized'}</Text></View><Badge label={status.label} variant={status.variant} /></View><View style={[styles.meta, { borderTopColor: theme.border }]}><Text style={[styles.metaText, { color: theme.text }]}><Text style={{ color: theme.textSecondary }}>Stock </Text>{stockText(product)}</Text><Text style={[styles.metaText, { color: theme.text }]}><Text style={{ color: theme.textSecondary }}>Sell </Text>{money(product.price)}</Text>{showCost && <Text style={[styles.metaText, { color: theme.text }]}><Text style={{ color: theme.textSecondary }}>Cost </Text>{money(product.cost_price)}</Text>}</View></Card>;
}

function ProductForm({ product, categories, showCost, showPrice, showStock, busy, onCancel, onSubmit }: { product: Product | null; categories: string[]; showCost: boolean; showPrice: boolean; showStock: boolean; busy: boolean; onCancel: () => void; onSubmit: (value: FormState) => void }) {
  const theme = useTheme();
  const [value, setValue] = useState<FormState>(() => product ? { name: product.name, category: product.category || '', cost: String(product.cost_price ?? ''), price: String(product.price ?? ''), stock: String(product.stock ?? ''), base: product.base_unit || '', converted: product.converted_unit || '', rate: String(product.conversion_rate ?? '') } : emptyForm);
  const [error, setError] = useState<string | null>(null);
  const update = (key: keyof FormState, next: string) => setValue((current) => ({ ...current, [key]: next }));
  const submit = () => {
    if (!value.name.trim() || !value.category.trim()) return setError('Product name and category are required.');
    if (showCost && value.cost !== '' && Number(value.cost) < 0) return setError('Cost price cannot be negative.');
    if (showPrice && value.price !== '' && Number(value.price) < 0) return setError('Sell price cannot be negative.');
    if (showStock && (!Number.isInteger(Number(value.stock)) || Number(value.stock) < 0)) return setError('Stock must be a non-negative whole number.');
    if (value.converted.trim() && !value.base.trim()) return setError('Base unit is required when a converted unit is provided.');
    if (value.converted.trim() && (!value.rate || Number(value.rate) <= 0)) return setError('Conversion rate is required when a converted unit is provided.');
    if (!value.converted.trim() && value.rate) return setError('Converted unit is required when a conversion rate is provided.');
    setError(null); onSubmit(value);
  };
  return <View style={styles.form}><View style={styles.formHeader}><Text style={[styles.title, { color: theme.text }]}>{product ? 'Edit product' : 'Add product'}</Text><Pressable onPress={onCancel}><Text style={{ color: theme.primary }}>Close</Text></Pressable></View>{error && <Text style={{ color: theme.danger }}>{error}</Text>}<Input label="Product name" value={value.name} onChangeText={(next) => update('name', next)} placeholder="Product name" /><Input label="Category" value={value.category} onChangeText={(next) => update('category', next)} placeholder="Category name" />{categories.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryOptions}>{categories.map((category) => <Pressable key={category} onPress={() => update('category', category)} style={[styles.categoryOption, { borderColor: value.category === category ? theme.primary : theme.border }]}><Text style={{ color: theme.text }}>{category}</Text></Pressable>)}</ScrollView>}{showCost && <Input label="Cost price" value={value.cost} onChangeText={(next) => update('cost', next.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />}{showPrice && <Input label="Sell price" value={value.price} onChangeText={(next) => update('price', next.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />}{showStock && <Input label="Stock" value={value.stock} onChangeText={(next) => update('stock', next.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="0" />}<Text style={[styles.formSection, { color: theme.text }]}>Stock unit conversion</Text><Input label="Base unit" value={value.base} onChangeText={(next) => update('base', next)} placeholder="e.g. box" /><Input label="Converted unit" value={value.converted} onChangeText={(next) => update('converted', next)} placeholder="e.g. piece" /><Input label="Conversion rate" value={value.rate} onChangeText={(next) => update('rate', next.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="e.g. 20" /><Button label={product ? 'Save changes' : 'Add product'} loading={busy} fullWidth onPress={submit} /></View>;
}

export default function InventoryScreen() {
  const theme = useTheme();
  const inventory = useInventory();
  const [selected, setSelected] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canManage = inventory.role === 'owner' || inventory.role === 'accountant';
  const showCost = inventory.visibleFields.has('cost_price');
  const showPrice = inventory.visibleFields.has('price');
  const showStock = inventory.visibleFields.has('stock');
  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const submit = async (value: FormState) => {
    const input: ProductInput = { name: value.name.trim(), category: value.category.trim(), ...(showCost ? { cost_price: Number(value.cost || 0) } : {}), ...(showPrice ? { price: Number(value.price || 0) } : {}), ...(showStock ? { stock: Number(value.stock || 0) } : {}), base_unit: value.base.trim() || null, converted_unit: value.converted.trim() || null, conversion_rate: value.rate ? Number(value.rate) : null };
    setBusy(true);
    const error = editing ? await inventory.updateProduct(editing.id, input) : (await inventory.addProduct(input)).error;
    setBusy(false);
    if (!error) { setFormOpen(false); setEditing(null); setSelected(null); }
  };
  const status = selected ? stockBadge(selected) : null;
  return <AppShell title="Inventory" subtitle="Manage products, stock, and pricing." action={canManage ? <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.primary} size={24} /> : undefined} actionLabel="Add product" onActionPress={canManage ? openAdd : undefined}><View style={styles.screen}><Input value={inventory.search} onChangeText={inventory.setSearch} placeholder="Search name, category, or price" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((filter) => <Pressable key={filter.value} onPress={() => inventory.setStockFilter(filter.value)} style={[styles.filter, { borderColor: inventory.stockFilter === filter.value ? theme.primary : theme.border }]}><Text style={{ color: inventory.stockFilter === filter.value ? theme.primary : theme.textSecondary }}>{filter.label}</Text></Pressable>)}</ScrollView><View style={styles.summary}><Text style={{ color: theme.textSecondary }}>{inventory.products.length} loaded</Text><Text style={{ color: theme.warning }}>{inventory.products.filter((item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) < 20).length} low</Text><Text style={{ color: theme.danger }}>{inventory.products.filter((item) => Number(item.stock || 0) === 0).length} out</Text></View>{inventory.loading ? <Card><LoadingState label="Loading products..." /></Card> : inventory.error ? <Card><EmptyState title="Inventory unavailable" description={inventory.error} action={<Button label="Try again" variant="secondary" onPress={inventory.refresh} />} /></Card> : inventory.products.length === 0 ? <Card><EmptyState title={inventory.search.trim() ? 'No matching products' : 'No products yet'} description={inventory.search.trim() ? 'Try another name, category, or price.' : 'Add your first product to start tracking stock.'} action={canManage && !inventory.search.trim() ? <Button label="Add product" onPress={openAdd} /> : undefined} /></Card> : <ScrollView contentContainerStyle={styles.list}>{inventory.products.map((product) => <ProductCard key={product.id} product={product} showCost={showCost} onPress={() => setSelected(product)} />)}{inventory.hasMore && <Button label="Load more" variant="secondary" loading={inventory.loadingMore} onPress={inventory.loadMore} />}</ScrollView>}</View><Modal visible={selected !== null} animationType="slide" onRequestClose={() => setSelected(null)}><View style={[styles.modal, { backgroundColor: theme.background }]}><View style={styles.formHeader}><Text style={[styles.title, { color: theme.text }]}>Product details</Text><Pressable onPress={() => setSelected(null)}><Text style={{ color: theme.primary }}>Close</Text></Pressable></View>{selected && <><Text style={[styles.detailName, { color: theme.text }]}>{selected.name}</Text><Text style={{ color: theme.textSecondary }}>{selected.category || 'Uncategorized'}</Text>{status && <Badge label={status.label} variant={status.variant} />}<Card compact style={styles.detailCard}><Text style={{ color: theme.text }}>Stock: {stockText(selected)}</Text><Text style={{ color: theme.text }}>Sell price: {money(selected.price)}</Text>{showCost && <Text style={{ color: theme.text }}>Cost: {money(selected.cost_price)}</Text>}</Card>{canManage && <View style={styles.actions}><Button label="Edit" variant="secondary" fullWidth onPress={() => { setEditing(selected); setSelected(null); setFormOpen(true); }} /><Button label="Delete" variant="danger" fullWidth onPress={async () => { const error = await inventory.deleteProduct(selected.id); if (!error) setSelected(null); }} /></View>}</>}</View></Modal><Modal visible={formOpen} animationType="slide" onRequestClose={() => setFormOpen(false)}><ScrollView style={[styles.modal, { backgroundColor: theme.background }]} contentContainerStyle={styles.form}><ProductForm key={editing?.id ?? 'new'} product={editing} categories={inventory.categories} showCost={showCost} showPrice={showPrice} showStock={showStock} busy={busy} onCancel={() => setFormOpen(false)} onSubmit={submit} /></ScrollView></Modal></AppShell>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: Spacing.two }, filters: { gap: Spacing.one, paddingVertical: Spacing.one }, filter: { minHeight: 40, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.pill, justifyContent: 'center' }, summary: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.one }, list: { gap: Spacing.two, paddingBottom: Spacing.five }, card: { gap: Spacing.three }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two }, image: { width: 58, height: 58, borderRadius: Radius.md }, imageFallback: { alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, gap: Spacing.one }, name: { ...Typography.label, fontSize: 16 }, category: { ...Typography.caption }, meta: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.one }, metaText: { ...Typography.caption, flexShrink: 1 }, modal: { flex: 1, padding: Spacing.four, paddingTop: Spacing.five }, form: { gap: Spacing.three, paddingBottom: Spacing.five }, formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.four }, title: { ...Typography.sectionTitle }, categoryOptions: { gap: Spacing.one }, categoryOption: { minHeight: 40, paddingHorizontal: Spacing.two, borderWidth: 1, borderRadius: Radius.pill, justifyContent: 'center' }, formSection: { ...Typography.label, marginBottom: -Spacing.two }, detailName: { ...Typography.screenTitle, marginBottom: Spacing.one }, detailCard: { marginTop: Spacing.four, gap: Spacing.two }, actions: { gap: Spacing.two, marginTop: Spacing.four },
});
