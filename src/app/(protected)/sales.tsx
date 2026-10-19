import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as Crypto from 'expo-crypto';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, FeedbackMessage, Input, KeyboardAwareScrollView, LoadingState, SectionHeader } from '@/components/ui';
import { ControlHeights, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSales, type Product, type Sale, type SaleInput } from '@/hooks/use-sales';

type CartLine = { product: Product; quantity: number; unit: 'base' | 'converted' };

function money(value: number | null | undefined) { return `$${Number(value || 0).toFixed(2)}`; }
function saleDate(sale: Sale) { return sale.created_at ? new Date(sale.created_at).toLocaleString('en-US', { timeZone: 'Africa/Mogadishu', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No date'; }
function saleTotal(sale: Sale) { const total = Math.abs(Number(sale.total || 0)); return sale.type === 'return' ? `-$${total.toFixed(2)}` : money(total); }
function unitLabel(product: Product, unit: 'base' | 'converted') { return unit === 'converted' ? product.converted_unit?.trim() || 'converted unit' : product.base_unit?.trim() || 'base unit'; }
function available(product: Product, unit: 'base' | 'converted', role: string | null, businessType: string) {
  const allocated = role === 'sales' && businessType === 'warehouse';
  if (allocated) {
    return unit === 'converted'
      ? Number(product.allocation_availability?.converted_quantity || 0)
      : Number(product.allocation_availability?.base_quantity || 0);
  }
  const baseQuantity = Number(product.stock || 0);
  if (unit === 'converted' && product.conversion_rate) {
    return baseQuantity * Number(product.conversion_rate) + Number(product.stock_remainder || 0);
  }
  return baseQuantity;
}

function SaleCard({ sale, onPress }: { sale: Sale; onPress: () => void }) {
  const theme = useTheme();
  const returned = sale.type === 'return';
  const statusLabel = returned ? 'Returned' : sale.paid === false ? 'Unpaid' : 'Paid';
  return (
    <Card compact interactive onPress={onPress}
      accessibilityLabel={`${sale.product_name || 'Unknown product'}, ${sale.quantity || 0} ${sale.quantity_unit || 'unit'}, ${saleTotal(sale)}, ${saleDate(sale)}, ${statusLabel}`}
      accessibilityHint="Open sale details" style={styles.saleCard}>
      <View style={styles.saleHeader}>
        <View style={styles.saleCopy}>
          <Text style={[styles.productName, { color: theme.text }]} numberOfLines={2}>{sale.product_name || 'Unknown product'}</Text>
          <Text style={[styles.saleMeta, { color: theme.textSecondary }]} numberOfLines={1}>{sale.customer_name || 'Walk-in customer'}</Text>
        </View>
        <Text style={[styles.amount, { color: returned ? theme.danger : theme.success }]}>{saleTotal(sale)}</Text>
      </View>
      <View style={styles.saleFacts}>
        <SaleFact label="Quantity" value={`${sale.quantity || 0} ${sale.quantity_unit || 'unit'}`} />
        <SaleFact label="Date" value={saleDate(sale)} />
        <SaleFact label="Reference" value={sale.order_id || 'None'} />
      </View>
      <Badge label={statusLabel} variant={returned ? 'danger' : sale.paid === false ? 'warning' : 'success'} />
    </Card>
  );
}

function SaleFact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={styles.saleFact}><Text style={[styles.factLabel, { color: theme.textSecondary }]}>{label}</Text><Text style={[styles.factValue, { color: theme.text }]} numberOfLines={2}>{value}</Text></View>;
}

function SaleForm({ products, role, businessType, busy, onCancel, onSubmit }: { products: Product[]; role: string | null; businessType: string; busy: boolean; onCancel: () => void; onSubmit: (input: SaleInput) => Promise<string | null> }) {
  const theme = useTheme();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [reference, setReference] = useState(() => `INV-${Date.now()}`);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState({ customer: false, phone: false });
  const [pendingAttempt, setPendingAttempt] = useState<{ signature: string; key: string } | null>(null);

  const availableProducts = products.filter((product) => available(product, 'base', role, businessType) > 0 || available(product, 'converted', role, businessType) > 0);
  const filteredProducts = availableProducts.filter((product) => product.name.toLowerCase().includes(productSearch.trim().toLowerCase()));
  const unitPrice = (product: Product, unit: 'base' | 'converted') => {
    const price = Number(product.price || 0);
    const allocated = role === 'sales' && businessType === 'warehouse';
    const conversionRate = allocated
      ? Number(product.allocation_availability?.conversion_rate || 0)
      : Number(product.conversion_rate || 0);
    return unit === 'converted' && conversionRate > 0 ? price / conversionRate : price;
  };
  const lineSubtotal = (line: CartLine) => line.quantity * unitPrice(line.product, line.unit);
  const cartTotal = cart.reduce((sum, line) => sum + lineSubtotal(line), 0);

  const resetSale = () => {
    setCart([]);
    setPickerOpen(false);
    setProductSearch('');
    setReference(`INV-${Date.now()}`);
    setCustomer('');
    setPhone('');
    setAddress('');
    setPaid(true);
    setError(null);
    setInvalidFields({ customer: false, phone: false });
  };

  const addProductToCart = (product: Product) => {
    const unit = available(product, 'base', role, businessType) > 0 ? 'base' : 'converted';
    const existing = cart.find((line) => line.product.id === product.id);
    const combinedQuantity = 1 + (existing?.quantity || 0);
    const maximum = available(product, unit, role, businessType);
    if (combinedQuantity > maximum) return setError(`Quantity for ${product.name} cannot exceed available stock (${maximum}).`);
    setCart((current) => {
      const line = current.find((item) => item.product.id === product.id);
      if (line) return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1, unit } : item);
      return [...current, { product, quantity: 1, unit }];
    });
    setProductSearch('');
    setError(null);
  };

  const adjustQuantity = (line: CartLine, delta: number) => {
    const quantity = line.quantity + delta;
    if (quantity < 1) return;
    const max = available(line.product, line.unit, role, businessType);
    if (quantity > max) return setError(`Quantity for ${line.product.name} cannot exceed available stock (${max}).`);
    setCart((current) => current.map((item) => item.product.id === line.product.id ? { ...item, quantity } : item));
    setError(null);
  };

  const changeUnit = (line: CartLine, unit: 'base' | 'converted') => {
    const max = available(line.product, unit, role, businessType);
    if (line.quantity > max) return setError(`Quantity for ${line.product.name} cannot exceed available stock (${max}) in ${unitLabel(line.product, unit)}.`);
    setCart((current) => current.map((item) => item.product.id === line.product.id ? { ...item, unit } : item));
    setError(null);
  };

  const submit = async () => {
    setInvalidFields({ customer: false, phone: false });
    if (cart.length === 0) return setError('Add at least one product to the sale.');
    const invalidLine = cart.find((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > available(line.product, line.unit, role, businessType));
    if (invalidLine) return setError(`Quantity for ${invalidLine.product.name} must be a whole number within available stock.`);
    if (!paid && (!customer.trim() || !phone.trim())) {
      setInvalidFields({ customer: !customer.trim(), phone: !phone.trim() });
      return setError('Customer name and phone are required for unpaid sales.');
    }
    const rawPhone = phone.trim();
    const digits = rawPhone.replace(/\D/g, '');
    const phoneForValidation = rawPhone.startsWith('+') ? `+${digits}` : `+252${digits}`;
    if (rawPhone && !/^\+\d{7,15}$/.test(phoneForValidation)) return setError('Please enter a valid phone number.');
    setError(null);
    const saleInput = {
      items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity, unit: line.unit })),
      order_id: reference.trim() || undefined,
      customer_name: customer.trim() || undefined,
      customer_phone: rawPhone ? phoneForValidation : undefined,
      customer_address: address.trim() || undefined,
      paid,
    };
    const signature = JSON.stringify(saleInput);
    const idempotency_key = pendingAttempt?.signature === signature
      ? pendingAttempt.key
      : Crypto.randomUUID();
    setPendingAttempt({ signature, key: idempotency_key });
    const submitError = await onSubmit({ ...saleInput, idempotency_key });
    if (submitError) return setError(submitError);
    setPendingAttempt(null);
    resetSale();
  };

  return (
    <>
      <KeyboardAwareScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.modal, styles.form]} keyboardShouldPersistTaps="handled">
        <View style={styles.formHeader}>
          <SectionHeader title="New sale" detail="Add one or more products to a single order." />
          <Button label="Close" size="sm" variant="ghost" disabled={busy} onPress={onCancel} />
        </View>
        <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>{businessType === 'warehouse' && role === 'sales' ? 'Warehouse sales use your taken allocations.' : 'Stock is checked by the sales service when you complete the order.'}</Text>
        {error ? <FeedbackMessage message={error} variant="error" /> : null}

        <View style={styles.formGroup}>
          <SectionHeader title="Current sale" detail={`${cart.length} product${cart.length === 1 ? '' : 's'} in this order`} />
          {cart.length === 0 ? <EmptyState title="No products added" description="Search the catalog and add products to start this sale." /> : (
            <View style={styles.cartLines}>
              {cart.map((line) => {
                const hasConversion = Boolean(line.product.base_unit?.trim() && line.product.converted_unit?.trim() && Number(line.product.conversion_rate || 0) > 0);
                const max = available(line.product, line.unit, role, businessType);
                return (
                  <Card key={line.product.id} compact style={styles.cartLine}>
                    <View style={styles.cartLineHeader}>
                      <View style={styles.cartLineCopy}>
                        <Text style={[styles.productName, { color: theme.text }]} numberOfLines={2}>{line.product.name}</Text>
                        <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>{money(unitPrice(line.product, line.unit))} / {unitLabel(line.product, line.unit)}</Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${line.product.name} from sale`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { setCart((current) => current.filter((item) => item.product.id !== line.product.id)); setError(null); }} style={styles.iconButton}>
                        <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor={theme.danger} size={20} />
                      </Pressable>
                    </View>
                    {hasConversion && <View style={styles.unitRow}>
                      <Button label={unitLabel(line.product, 'base')} size="md" variant={line.unit === 'base' ? 'primary' : 'secondary'} accessibilityState={{ selected: line.unit === 'base' }} disabled={busy} onPress={() => changeUnit(line, 'base')} />
                      <Button label={unitLabel(line.product, 'converted')} size="md" variant={line.unit === 'converted' ? 'primary' : 'secondary'} accessibilityState={{ selected: line.unit === 'converted' }} disabled={busy} onPress={() => changeUnit(line, 'converted')} />
                    </View>}
                    <View style={styles.cartLineFooter}>
                      <View style={styles.quantityControl}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${line.product.name} quantity`} accessibilityState={{ disabled: busy || line.quantity <= 1 }} disabled={busy || line.quantity <= 1} onPress={() => adjustQuantity(line, -1)} style={[styles.quantityButton, { borderColor: theme.border }]}><SymbolView name={{ ios: 'minus', android: 'remove', web: 'remove' }} tintColor={theme.text} size={18} /></Pressable>
                        <Text accessibilityLabel={`Quantity ${line.quantity}`} style={[styles.quantityValue, { color: theme.text }]}>{line.quantity}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${line.product.name} quantity`} accessibilityState={{ disabled: busy || line.quantity >= max }} disabled={busy || line.quantity >= max} onPress={() => adjustQuantity(line, 1)} style={[styles.quantityButton, { borderColor: theme.border }]}><SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.text} size={18} /></Pressable>
                      </View>
                      <View style={styles.subtotalCopy}><Text style={[styles.saleMeta, { color: theme.textSecondary }]}>Subtotal</Text><Text style={[styles.lineSubtotal, { color: theme.text }]}>{money(lineSubtotal(line))}</Text></View>
                    </View>
                    <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>Available: {max} {unitLabel(line.product, line.unit)}</Text>
                  </Card>
                );
              })}
            </View>
          )}
          <Button label="Add product" icon={<SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.primaryText} size={18} />} fullWidth disabled={busy || availableProducts.length === 0} onPress={() => { setPickerOpen((current) => !current); setProductSearch(''); setError(null); }} />
          {pickerOpen && (
            <View style={styles.inlinePicker}>
              <View style={styles.formHeader}>
                <SectionHeader title="Choose a product" detail="Search your catalog and set the quantity." />
                <Button label="Close" size="sm" variant="ghost" disabled={busy} onPress={() => setPickerOpen(false)} />
              </View>
              <Input label="Search products" value={productSearch} onChangeText={setProductSearch} placeholder="Product name" returnKeyType="search" editable={!busy} />
              {filteredProducts.length === 0 ? <EmptyState title="No matching products" description="Try another product name." /> : (
                <View style={styles.productResults}>
                  {filteredProducts.map((product) => {
                    const productUnit = available(product, 'base', role, businessType) > 0 ? 'base' : 'converted';
                    const quantityAvailable = available(product, productUnit, role, businessType);
                    return (
                      <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`Add ${product.name}, ${money(product.price)}, ${quantityAvailable} ${unitLabel(product, productUnit)} available`} disabled={busy} onPress={() => addProductToCart(product)} style={[styles.productOption, { borderColor: theme.border, backgroundColor: theme.card }]}>
                        <View style={styles.copy}>
                          <Text style={[styles.productName, { color: theme.text }]} numberOfLines={2}>{product.name}</Text>
                          <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>{money(product.price)} · {quantityAvailable} {unitLabel(product, productUnit)} available</Text>
                        </View>
                        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.primaryStrong} size={20} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
        <Card compact style={styles.orderTotal}><Text style={[styles.saleMeta, { color: theme.textSecondary }]}>Order total</Text><Text style={[styles.total, { color: theme.text }]}>{money(cartTotal)}</Text></Card>
        <View style={styles.formGroup}><SectionHeader title="Reference" /><Input label="Reference" value={reference} onChangeText={setReference} placeholder="INV-..." editable={!busy} /></View>
        <View style={styles.formGroup}>
          <SectionHeader title="Customer" />
          <Input label="Customer name" value={customer} onChangeText={(value) => { setCustomer(value); setError(null); setInvalidFields((current) => ({ ...current, customer: false })); }} placeholder="Walk-in customer" error={invalidFields.customer ? 'Enter a customer name for an unpaid sale.' : undefined} editable={!busy} />
          <Input label="Phone" value={phone} onChangeText={(value) => { setPhone(value); setError(null); setInvalidFields((current) => ({ ...current, phone: false })); }} keyboardType="phone-pad" placeholder="Required for unpaid sales" error={invalidFields.phone ? 'Enter a phone number for an unpaid sale.' : undefined} editable={!busy} />
          <Input label="Address" value={address} onChangeText={setAddress} placeholder="Optional" editable={!busy} />
        </View>
        <View style={styles.formGroup}>
          <SectionHeader title="Payment" />
          <View style={styles.unitRow}>
            <Button label="Paid" icon={paid ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={theme.successText} size={16} /> : undefined} variant={paid ? 'success' : 'secondary'} accessibilityState={{ selected: paid }} disabled={busy} onPress={() => { setPaid(true); setError(null); setInvalidFields((current) => ({ ...current, customer: false, phone: false })); }} />
            <Button label="Pay later" icon={!paid ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={theme.warningText} size={16} /> : undefined} variant={!paid ? 'warning' : 'secondary'} accessibilityState={{ selected: !paid }} disabled={busy} onPress={() => { setPaid(false); setError(null); }} />
          </View>
          {!paid && <Text style={[styles.saleMeta, { color: theme.warning }]}>A debt is created by the existing sales service.</Text>}
        </View>
        <Button label="Complete sale" loading={busy} fullWidth disabled={cart.length === 0} onPress={submit} />
      </KeyboardAwareScrollView>

    </>
  );
}

export default function SalesScreen() {
  const theme = useTheme();
  const state = useSales();
  const [selected, setSelected] = useState<Sale | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [busy, setBusy] = useState(false);
  const canCreate = state.role === 'owner' || state.role === 'sales';
  const openSale = () => { setFormSession((current) => current + 1); setFormOpen(true); };
  const submit = async (input: SaleInput): Promise<string | null> => {
    setBusy(true);
    const error = await state.createSale(input);
    setBusy(false);
    if (!error) setFormOpen(false);
    return error;
  };

  return (
    <AppShell
      title="Sales"
      subtitle="Create multi-product sales and review transactions."
      action={canCreate ? <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.primary} size={24} /> : undefined}
      actionLabel={canCreate ? 'Record sale' : undefined}
      onActionPress={canCreate ? openSale : undefined}>
      <View style={styles.screen}>
        <FlatList
          data={state.sales}
          keyExtractor={(sale) => sale.id}
          renderItem={({ item }) => <SaleCard sale={item} onPress={() => setSelected(item)} />}
          ListHeaderComponent={(
            <View style={styles.listHeader}>
              <Input label="Search sales" helperText="Search by product, customer, phone, or reference." value={state.search} onChangeText={state.setSearch} placeholder="Product, customer, phone, or reference" returnKeyType="search" clearButtonMode="while-editing" />
              <View style={styles.dateFilter}>
                <SectionHeader title="Filter by date" detail="Enter a date in YYYY-MM-DD format." />
                <Input label="Sale date" value={state.date} onChangeText={state.setDate} placeholder="YYYY-MM-DD" accessibilityHint="Filters sales by the date entered" />
                <View style={styles.dateActions}><Button label="Clear filters" size="sm" variant="ghost" accessibilityHint="Clears the sales search and date filters" onPress={() => { state.setSearch(''); state.setDate(''); }} /></View>
              </View>
              <SectionHeader title="Sales history" detail="Showing the latest matching sales." />
              {state.error && state.sales.length > 0 ? <View style={styles.stateContent}><FeedbackMessage message={state.error} variant="error" /><Button label="Try again" variant="secondary" onPress={state.refresh} /></View> : null}
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.stateWrap}>
              {state.loading ? <LoadingState label="Loading sales..." /> : state.error ? (
                <View style={styles.stateContent}><FeedbackMessage message={state.error} variant="error" /><Button label="Try again" variant="secondary" onPress={state.refresh} /></View>
              ) : (
                <EmptyState title={state.search || state.date ? 'No matching sales' : 'No sales recorded yet'} description={state.search || state.date ? 'Try another search or date.' : 'Completed multi-product orders will appear here, one row per item.'} action={canCreate && !state.search && !state.date ? <Button label="Record sale" onPress={openSale} /> : undefined} />
              )}
            </View>
          )}
          style={styles.salesList}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>

      <Modal visible={selected !== null} animationType="slide" onRequestClose={() => setSelected(null)}>
        <ScrollView style={[styles.detailScroll, { backgroundColor: theme.background }]} contentContainerStyle={styles.modal}>
          <View style={styles.formHeader}><SectionHeader title="Sale details" /><Button label="Close" size="sm" variant="ghost" onPress={() => setSelected(null)} /></View>
          {selected && <>
            <Text style={[styles.detailName, { color: theme.text }]}>{selected.product_name || 'Unknown product'}</Text>
            <Badge label={selected.type === 'return' ? 'Returned' : selected.paid === false ? 'Unpaid' : 'Paid'} variant={selected.type === 'return' ? 'danger' : selected.paid === false ? 'warning' : 'success'} />
            <Card compact style={styles.detailCard}>
              <DetailRow label="Reference" value={selected.order_id || 'None'} />
              <DetailRow label="Customer" value={selected.customer_name || 'Walk-in customer'} />
              {selected.customer_phone ? <DetailRow label="Phone" value={selected.customer_phone} /> : null}
              {selected.customer_address ? <DetailRow label="Address" value={selected.customer_address} /> : null}
              <DetailRow label="Quantity" value={`${selected.quantity || 0} ${selected.quantity_unit || 'unit'}`} />
              <DetailRow label="Total" value={saleTotal(selected)} />
              <DetailRow label="Date" value={saleDate(selected)} />
            </Card>
          </>}
        </ScrollView>
      </Modal>

      <Modal visible={formOpen} animationType="slide" onRequestClose={() => !busy && setFormOpen(false)}>
        <View style={[styles.saleModal, { backgroundColor: theme.background }]}>
          <SaleForm key={formSession} products={state.products} role={state.role} businessType={state.businessType} busy={busy} onCancel={() => !busy && setFormOpen(false)} onSubmit={submit} />
        </View>
      </Modal>
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={[styles.detailRow, { borderBottomColor: theme.border }]}><Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text><Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, salesList: { flex: 1 }, listHeader: { gap: Spacing.lg, paddingBottom: Spacing.lg }, list: { flexGrow: 1, gap: Spacing.md, paddingBottom: Spacing.xxl },
  stateWrap: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.xl }, stateContent: { gap: Spacing.md }, saleCard: { gap: Spacing.md }, saleHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }, saleCopy: { flex: 1, gap: Spacing.xs },
  productName: { ...Typography.body, fontWeight: '600' }, saleMeta: { ...Typography.caption }, amount: { ...Typography.body, fontWeight: '700' }, saleFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }, saleFact: { flexGrow: 1, flexBasis: '42%', gap: Spacing.xxs }, factLabel: { ...Typography.caption }, factValue: { ...Typography.label }, saleFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, dateFilter: { gap: Spacing.sm }, dateActions: { alignItems: 'flex-end' },
  modal: { flexGrow: 1, padding: Layout.pagePadding, paddingTop: Spacing.xl, gap: Spacing.lg }, detailScroll: { flex: 1 }, saleModal: { flex: 1 }, form: { gap: Spacing.xl, paddingBottom: Spacing.xxl }, formGroup: { gap: Spacing.md }, formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cartLines: { gap: Spacing.md }, cartLine: { gap: Spacing.md }, cartLineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }, cartLineCopy: { flex: 1, gap: Spacing.xs }, iconButton: { width: ControlHeights.standard, height: ControlHeights.standard, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }, cartLineFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.md }, quantityControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, quantityButton: { width: ControlHeights.standard, height: ControlHeights.standard, borderWidth: 1, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }, quantityValue: { ...Typography.sectionTitle, minWidth: 32, textAlign: 'center' }, subtotalCopy: { alignItems: 'flex-end', gap: Spacing.xxs }, lineSubtotal: { ...Typography.label }, orderTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }, inlinePicker: { gap: Spacing.lg, marginTop: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#cbd5e1' }, productResults: { gap: Spacing.sm }, productOption: { minHeight: ControlHeights.large, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, copy: { flex: 1, gap: Spacing.xxs }, selectedCard: { gap: Spacing.md }, unitRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }, total: { ...Typography.sectionTitle }, detailName: { ...Typography.screenTitle, marginBottom: Spacing.sm }, detailCard: { gap: Spacing.md }, detailRow: { gap: Spacing.xxs, paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth }, detailLabel: { ...Typography.caption }, detailValue: { ...Typography.body },
});