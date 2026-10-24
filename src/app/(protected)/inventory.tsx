import { useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, FeedbackMessage, Input, KeyboardAwareScrollView, LoadingState, SectionHeader } from '@/components/ui';
import { ControlHeights, Layout, Radius, Spacing, Typography } from '@/constants/theme';
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
  return (
    <Card
      compact
      interactive
      onPress={onPress}
      accessibilityLabel={`${product.name}, ${product.category || 'Uncategorized'}, ${status.label}, stock ${stockText(product)}, sell price ${money(product.price)}`}
      accessibilityHint="View product details"
      style={styles.productCard}>
      <View style={styles.cardTop}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imageFallback, { backgroundColor: theme.surface }]}>
            <Text style={[styles.imageFallbackText, { color: theme.textMuted }]}>No image</Text>
          </View>
        )}
        <View style={styles.copy}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{product.name}</Text>
          <Text style={[styles.category, { color: theme.textSecondary }]} numberOfLines={1}>{product.category || 'Uncategorized'}</Text>
        </View>
        <Badge label={status.label} variant={status.variant} />
      </View>
      <View style={styles.productFacts}>
        <View style={styles.fact}>
          <Text style={[styles.factLabel, { color: theme.textSecondary }]}>Stock</Text>
          <Text style={[styles.factValue, { color: theme.text }]}>{stockText(product)}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={[styles.factLabel, { color: theme.textSecondary }]}>Sell price</Text>
          <Text style={[styles.factValue, { color: theme.text }]}>{money(product.price)}</Text>
        </View>
        {showCost && (
          <View style={styles.fact}>
            <Text style={[styles.factLabel, { color: theme.textSecondary }]}>Cost</Text>
            <Text style={[styles.factValue, { color: theme.text }]}>{money(product.cost_price)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

function ProductForm({ product, categories, showCost, showPrice, showStock, busy, submitError, onCancel, onSubmit }: { product: Product | null; categories: string[]; showCost: boolean; showPrice: boolean; showStock: boolean; busy: boolean; submitError: string | null; onCancel: () => void; onSubmit: (value: FormState, image: Pick<ImagePicker.ImagePickerAsset, 'uri' | 'width' | 'height'> | null) => void }) {
  const theme = useTheme();
  const [value, setValue] = useState<FormState>(() => product ? { name: product.name, category: product.category || '', cost: String(product.cost_price ?? ''), price: String(product.price ?? ''), stock: String(product.stock ?? ''), base: product.base_unit || '', converted: product.converted_unit || '', rate: String(product.conversion_rate ?? '') } : emptyForm);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const update = (key: keyof FormState, next: string) => {
    setValue((current) => ({ ...current, [key]: next }));
    setError(null);
    setInvalidFields((current) => ({ ...current, [key]: false }));
  };
  const submit = () => {
    setInvalidFields({});
    if (!value.name.trim() || !value.category.trim()) {
      setInvalidFields({ name: !value.name.trim(), category: !value.category.trim() });
      return setError('Product name and category are required.');
    }
    if (showCost && value.cost !== '' && (!Number.isFinite(Number(value.cost)) || Number(value.cost) < 0)) {
      setInvalidFields({ cost: true });
      return setError('Cost price must be a valid non-negative number.');
    }
    if (showPrice && value.price !== '' && (!Number.isFinite(Number(value.price)) || Number(value.price) < 0)) {
      setInvalidFields({ price: true });
      return setError('Sell price must be a valid non-negative number.');
    }
    if (showStock && (!Number.isInteger(Number(value.stock)) || Number(value.stock) < 0)) {
      setInvalidFields({ stock: true });
      return setError('Stock must be a non-negative whole number.');
    }
    if (value.converted.trim() && !value.base.trim()) {
      setInvalidFields({ base: true });
      return setError('Base unit is required when a converted unit is provided.');
    }
    if (value.rate && (!Number.isFinite(Number(value.rate)) || Number(value.rate) <= 0)) {
      setInvalidFields({ rate: true });
      return setError('Conversion rate must be a valid positive number.');
    }
    if (value.converted.trim() && !value.rate) {
      setInvalidFields({ rate: true });
      return setError('Conversion rate is required when a converted unit is provided.');
    }
    if (!value.converted.trim() && value.rate) {
      setInvalidFields({ converted: true });
      return setError('Converted unit is required when a conversion rate is provided.');
    }
    setError(null);
    onSubmit(value, image ? { uri: image.uri, width: image.width, height: image.height } : null);
  };
  const pickImage = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled) setImage(result.assets[0] ?? null);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'Unable to open your photo library.');
    }
  };
  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <SectionHeader title={product ? 'Edit product' : 'Add product'} detail="Enter the details used to identify and manage this item." />
        <Button label="Close" size="sm" variant="ghost" onPress={onCancel} />
      </View>
      {error ? <FeedbackMessage message={error} variant="error" /> : null}
      {submitError ? <FeedbackMessage message={submitError} variant="error" /> : null}

      <View style={styles.formGroup}>
        <SectionHeader title="Product information" />
        <Input label="Product name" value={value.name} onChangeText={(next) => update('name', next)} placeholder="Product name" error={invalidFields.name ? 'Enter a product name.' : undefined} editable={!busy} />
        <Input label="Category" value={value.category} onChangeText={(next) => update('category', next)} placeholder="Category name" error={invalidFields.category ? 'Choose or enter a category.' : undefined} editable={!busy} />
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryOptions}>
            {categories.map((category) => {
              const selectedCategory = value.category === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityLabel={category}
                  accessibilityState={{ selected: selectedCategory, disabled: busy }}
                  disabled={busy}
                  onPress={() => update('category', category)}
                  style={({ pressed }) => [styles.categoryOption, { borderColor: selectedCategory ? theme.primaryStrong : theme.border, backgroundColor: selectedCategory ? theme.backgroundSelected : theme.surface }, pressed && styles.pressed]}>
                  {selectedCategory && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={theme.primaryStrong} size={16} />}
                  <Text style={[styles.categoryOptionText, { color: theme.text }]}>{category}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {(showCost || showPrice) && (
        <View style={styles.formGroup}>
          <SectionHeader title="Pricing" />
          {showCost && <Input label="Cost price" value={value.cost} onChangeText={(next) => update('cost', next.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" error={invalidFields.cost ? 'Enter a valid non-negative cost.' : undefined} editable={!busy} />}
          {showPrice && <Input label="Sell price" value={value.price} onChangeText={(next) => update('price', next.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" error={invalidFields.price ? 'Enter a valid non-negative price.' : undefined} editable={!busy} />}
        </View>
      )}

      {showStock && (
        <View style={styles.formGroup}>
          <SectionHeader title="Stock" />
          <Input label="Stock quantity" value={value.stock} onChangeText={(next) => update('stock', next.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="0" error={invalidFields.stock ? 'Enter a non-negative whole quantity.' : undefined} editable={!busy} />
        </View>
      )}

      <View style={styles.formGroup}>
        <SectionHeader title="Units and conversion" detail="Optional. Use these fields when stock is tracked in related units." />
        <Input label="Base unit" value={value.base} onChangeText={(next) => update('base', next)} placeholder="e.g. box" error={invalidFields.base ? 'A base unit is needed for conversion.' : undefined} editable={!busy} />
        <Input label="Converted unit" value={value.converted} onChangeText={(next) => update('converted', next)} placeholder="e.g. piece" error={invalidFields.converted ? 'Enter the converted unit.' : undefined} editable={!busy} />
        <Input label="Conversion rate" value={value.rate} onChangeText={(next) => update('rate', next.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="e.g. 20" error={invalidFields.rate ? 'Enter a valid positive conversion rate.' : undefined} editable={!busy} />
      </View>

      {!product && (
        <View style={styles.formGroup}>
          <SectionHeader title="Product image" detail="Optional. Add a photo to recognize this product." />
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.imagePreview} accessibilityLabel="Selected product image preview" />
          ) : null}
          <View style={styles.imageActions}>
            <Button label={image ? 'Change image' : 'Choose image'} variant="secondary" disabled={busy} onPress={pickImage} />
            {image ? <Button label="Remove image" variant="ghost" disabled={busy} onPress={() => setImage(null)} /> : null}
          </View>
        </View>
      )}

      <Button label={product ? 'Save changes' : 'Add product'} loading={busy} fullWidth onPress={submit} />
    </View>
  );
}

export default function InventoryScreen() {
  const theme = useTheme();
  const inventory = useInventory();
  const [selected, setSelected] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canManage = inventory.role === 'owner' || inventory.role === 'accountant';
  const showCost = inventory.visibleFields.has('cost_price');
  const showPrice = inventory.visibleFields.has('price');
  const showStock = inventory.visibleFields.has('stock');
  const openAdd = () => { setEditing(null); setMutationError(null); setFormOpen(true); };
  const submit = async (value: FormState, image: Pick<ImagePicker.ImagePickerAsset, 'uri' | 'width' | 'height'> | null) => {
    const input: ProductInput = { name: value.name.trim(), category: value.category.trim(), ...(showCost ? { cost_price: Number(value.cost || 0) } : {}), ...(showPrice ? { price: Number(value.price || 0) } : {}), ...(showStock ? { stock: Number(value.stock || 0) } : {}), base_unit: value.base.trim() || null, converted_unit: value.converted.trim() || null, conversion_rate: value.rate ? Number(value.rate) : null };
    setMutationError(null);
    setBusy(true);
    const error = editing ? await inventory.updateProduct(editing.id, input) : (await inventory.addProduct(input, image ?? undefined)).error;
    setBusy(false);
    setMutationError(error);
    if (!error) { setFormOpen(false); setEditing(null); setSelected(null); }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const error = await inventory.deleteProduct(deleteTarget.id);
    setDeleteBusy(false);
    if (error) {
      setDeleteError(error);
      return;
    }
    setDeleteTarget(null);
    setDeleteError(null);
    setSelected(null);
  };
  const status = selected ? stockBadge(selected) : null;
  return (
    <AppShell
      title={formOpen ? (editing ? 'Edit product' : 'Add product') : 'Inventory'}
      subtitle={formOpen ? 'Enter the details used to manage this item.' : 'Manage products, stock, and pricing.'}
      action={!formOpen && canManage ? <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.primary} size={24} /> : undefined}
      actionLabel={!formOpen && canManage ? 'Add product' : undefined}
      onActionPress={!formOpen && canManage ? openAdd : undefined}>
      {formOpen ? (
        <KeyboardAwareScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.form}>
          <ProductForm key={editing?.id ?? 'new'} product={editing} categories={inventory.categories} showCost={showCost} showPrice={showPrice} showStock={showStock} busy={busy} submitError={mutationError} onCancel={() => !busy && setFormOpen(false)} onSubmit={submit} />
        </KeyboardAwareScrollView>
      ) : (
      <View style={styles.screen}>
        <FlatList
          data={inventory.products}
          keyExtractor={(product) => product.id}
          renderItem={({ item }) => <ProductCard product={item} showCost={showCost} onPress={() => setSelected(item)} />}
          ListHeaderComponent={(
            <View style={styles.listHeader}>
              {inventory.error && inventory.products.length > 0 ? (
                <View style={styles.stateContent}>
                  <FeedbackMessage message={inventory.error} variant="error" />
                  <Button label="Retry loading" variant="secondary" onPress={inventory.refresh} />
                </View>
              ) : null}
              <Input
                label="Search inventory"
                helperText="Search by product name, category, or exact price."
                value={inventory.search}
                onChangeText={inventory.setSearch}
                placeholder="Name, category, or price"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              <View>
                <Text style={[styles.groupLabel, { color: theme.text }]}>Stock status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                  {filters.map((filter) => {
                    const isSelected = inventory.stockFilter === filter.value;
                    return (
                      <Pressable
                        key={filter.value}
                        accessibilityRole="button"
                        accessibilityLabel={`${filter.label} stock filter`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => inventory.setStockFilter(filter.value)}
                        style={({ pressed }) => [styles.filter, { borderColor: isSelected ? theme.primaryStrong : theme.border, backgroundColor: isSelected ? theme.backgroundSelected : theme.surface }, pressed && styles.pressed]}>
                        {isSelected && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={theme.primaryStrong} size={16} />}
                        <Text style={[styles.filterLabel, { color: theme.text }]}>{filter.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={[styles.summary, { borderColor: theme.border }]}>
                <View style={styles.summaryHeading}>
                  <SectionHeader title="Inventory results" detail="Counts apply only to the products currently loaded and matching search and stock filters." />
                </View>
                <View style={styles.counts}>
                  <Count label="Shown" value={inventory.products.length} />
                  <Count label="Below 20 in results" value={inventory.products.filter((item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) < 20).length} />
                  <Count label="Out in results" value={inventory.products.filter((item) => Number(item.stock || 0) === 0).length} />
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.stateWrap}>
              {inventory.loading ? (
                <LoadingState label="Loading inventory..." />
              ) : inventory.error ? (
                <View style={styles.stateContent}>
                  <FeedbackMessage message={inventory.error} variant="error" />
                  <Button label="Try again" variant="secondary" onPress={inventory.refresh} />
                </View>
              ) : (
                <EmptyState
                  title={inventory.search.trim() || inventory.stockFilter !== 'all' ? 'No matching products' : 'No products yet'}
                  description={inventory.search.trim() || inventory.stockFilter !== 'all' ? 'Try another search or stock filter.' : 'Add your first product to start tracking stock.'}
                  action={canManage && !inventory.search.trim() && inventory.stockFilter === 'all' ? <Button label="Add product" onPress={openAdd} /> : undefined}
                />
              )}
            </View>
          )}
          ListFooterComponent={inventory.hasMore && !inventory.loading && !inventory.error ? <Button label="Load more products" variant="secondary" loading={inventory.loadingMore} onPress={inventory.loadMore} /> : null}
          style={styles.productList}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>
      )}

      <Modal visible={selected !== null} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.formHeader}>
            <SectionHeader title="Product details" />
            <Button label="Close" size="sm" variant="ghost" onPress={() => setSelected(null)} />
          </View>
          {selected && (
            <>
              <Text style={[styles.detailName, { color: theme.text }]}>{selected.name}</Text>
              <Text style={[styles.category, { color: theme.textSecondary }]}>{selected.category || 'Uncategorized'}</Text>
              {status && <Badge label={status.label} variant={status.variant} />}
              <Card compact style={styles.detailCard}>
                <Text style={[styles.detailFact, { color: theme.text }]}>Stock: {stockText(selected)}</Text>
                <Text style={[styles.detailFact, { color: theme.text }]}>Sell price: {money(selected.price)}</Text>
                {showCost && <Text style={[styles.detailFact, { color: theme.text }]}>Cost: {money(selected.cost_price)}</Text>}
              </Card>
              {canManage && (
                <View style={styles.actions}>
                  <Button label="Edit product" variant="secondary" fullWidth onPress={() => { setEditing(selected); setMutationError(null); setSelected(null); setFormOpen(true); }} />
                  <Button label="Delete product" variant="danger" fullWidth onPress={() => { setDeleteError(null); setDeleteTarget(selected); }} />
                </View>
              )}
            </>
          )}
        </View>
      </Modal>

      <Modal visible={deleteTarget !== null} animationType="fade" transparent onRequestClose={() => !deleteBusy && setDeleteTarget(null)}>
        <View style={[styles.confirmBackdrop, { backgroundColor: `${theme.shadow}88` }]}>
          <View style={[styles.confirmDialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SectionHeader title="Delete product?" detail={deleteTarget ? `Delete ${deleteTarget.name} from inventory? This action cannot be undone.` : undefined} />
            {deleteError ? <FeedbackMessage message={deleteError} variant="error" /> : null}
            <View style={styles.confirmActions}>
              <Button label="Cancel" variant="secondary" disabled={deleteBusy} onPress={() => setDeleteTarget(null)} />
              <Button label="Delete product" variant="danger" loading={deleteBusy} onPress={confirmDelete} />
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={styles.count}>
      <Text style={[styles.countValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listHeader: { gap: Spacing.lg, paddingBottom: Spacing.lg },
  groupLabel: { ...Typography.label, marginBottom: Spacing.sm },
  filters: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  filter: { minHeight: ControlHeights.standard, paddingHorizontal: Spacing.lg, borderWidth: 1, borderRadius: Radius.md, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  filterLabel: { ...Typography.label },
  summary: { paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.md },
  summaryHeading: { gap: Spacing.xs },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xl },
  count: { minWidth: 88, gap: Spacing.xxs },
  countValue: { ...Typography.metric },
  countLabel: { ...Typography.caption },
  productList: { flex: 1 },
  list: { flexGrow: 1, gap: Spacing.md, paddingBottom: Spacing.xxl },
  stateWrap: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.xl },
  stateContent: { gap: Spacing.md },
  productCard: { gap: Spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  image: { width: 58, height: 58, borderRadius: Radius.md },
  imagePreview: { width: 112, height: 112, borderRadius: Radius.md, backgroundColor: '#e5e7eb' },
  imageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageFallbackText: { ...Typography.caption, textAlign: 'center' },
  copy: { flex: 1, gap: Spacing.one },
  name: { ...Typography.label, fontSize: 16 },
  category: { ...Typography.caption },
  productFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  fact: { flexGrow: 1, flexBasis: '40%', gap: Spacing.xxs },
  factLabel: { ...Typography.caption },
  factValue: { ...Typography.label },
  modal: { flex: 1, padding: Layout.pagePadding, paddingTop: Spacing.xl },
  form: { gap: Spacing.xl, paddingBottom: Spacing.xxl },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  formGroup: { gap: Spacing.md },
  categoryOptions: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  categoryOption: { minHeight: ControlHeights.standard, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: Radius.md, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  categoryOptionText: { ...Typography.label },
  pressed: { opacity: 0.75 },
  detailName: { ...Typography.screenTitle, marginBottom: Spacing.one },
  detailFact: { ...Typography.body },
  detailCard: { marginTop: Spacing.xl, gap: Spacing.two },
  actions: { gap: Spacing.two, marginTop: Spacing.xl },
  confirmBackdrop: { flex: 1, justifyContent: 'center', padding: Layout.pagePadding },
  confirmDialog: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.lg },
  confirmActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: Spacing.sm },
});
