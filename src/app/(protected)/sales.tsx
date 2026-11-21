import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';

import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, EmptyState, FeedbackMessage, Input, KeyboardAwareScrollView, LoadingState, SectionHeader } from '@/components/ui';
import { ControlHeights, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSales, type BusinessSettings, type Product, type ReturnInput, type Sale, type SaleInput } from '@/hooks/use-sales';
import { createReceiptHtml, type ReceiptData, type ReceiptLine, receiptDataForSales } from '@/lib/sales-receipt';
import { isPhoneNumber, normalizePhoneNumber, phoneCountryOptions } from '@/lib/phone-number';

type CartLine = { product: Product; quantity: number; unit: 'base' | 'converted' };
type ReturnAttempt = { signature: string; key: string };

function money(value: number | null | undefined) { return `$${Number(value || 0).toFixed(2)}`; }
function saleDate(sale: Sale) { return sale.created_at ? new Date(sale.created_at).toLocaleString('en-US', { timeZone: 'Africa/Mogadishu', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No date'; }
function saleTotal(sale: Sale) { const total = Math.abs(Number(sale.total || 0)); return sale.type === 'return' ? `-$${total.toFixed(2)}` : money(total); }
function signedSaleTotal(sale: Sale) {
  const total = Math.abs(Number(sale.total || 0));
  return sale.type === 'return' ? -total : total;
}
function saleDay(sale: Sale) {
  if (!sale.created_at) return null;
  const date = new Date(sale.created_at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
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

function remainingReturnQuantity(sale: Sale, sales: Sale[]) {
  const saleReference = sale.order_id;
  const saleProductId = sale.product_id;
  const saleProductName = sale.product_name || 'Unknown product';
  const saleCustomer = sale.customer_name;
  let sold = 0;
  let returned = 0;

  for (const candidate of sales) {
    const sameReference = !saleReference || !candidate.order_id || candidate.order_id === saleReference;
    const sameProduct = candidate.product_id === saleProductId || candidate.product_name === saleProductName;
    const sameCustomer = !saleCustomer || !candidate.customer_name || candidate.customer_name === saleCustomer;
    if (!sameReference || !sameProduct || !sameCustomer) continue;

    const quantity = Number(candidate.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (candidate.type === 'return') returned += quantity;
    else sold += quantity;
  }

  return Math.max(0, sold - returned);
}

function getSaleReceipt(sales: Sale[], selected: Sale, business: BusinessSettings): ReceiptData {
  const saleRows = selected.order_id
    ? sales.filter((sale) => sale.order_id === selected.order_id && sale.type !== 'return')
    : [selected];
  return receiptDataForSales(business, saleRows.length > 0 ? saleRows : [selected]);
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

function SalesAnalytics({ sales, loading }: { sales: Sale[]; loading: boolean }) {
  const theme = useTheme();
  const [showAllDailyRevenue, setShowAllDailyRevenue] = useState(false);
  const [showAllRevenueTrend, setShowAllRevenueTrend] = useState(false);
  const { totalRevenue, dailyData } = useMemo(() => {
    const daily: Record<string, number> = {};
    let total = 0;

    for (const sale of sales) {
      const signed = signedSaleTotal(sale);
      total += signed;
      const day = saleDay(sale);
      if (day) daily[day] = (daily[day] || 0) + signed;
    }

    const chart = Object.entries(daily)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14)
      .reverse();

    return { totalRevenue: total, dailyData: chart };
  }, [sales]);

  const maximum = Math.max(1, ...dailyData.map((item) => Math.abs(item.value)));
  const newestFirst = [...dailyData].reverse();
  const visibleDailyRevenue = showAllDailyRevenue ? newestFirst : newestFirst.slice(0, 3);
  const visibleRevenueTrend = showAllRevenueTrend ? dailyData : dailyData.slice(-3);

  return (
    <View style={styles.analytics}>
      <Card compact style={styles.revenueCard}>
        <Text style={[styles.analyticsLabel, { color: theme.textSecondary }]}>Total revenue</Text>
        {loading ? (
          <LoadingState label="Loading sales summary..." />
        ) : (
          <Text style={[styles.revenueValue, { color: totalRevenue >= 0 ? theme.success : theme.danger }]}>
            {totalRevenue >= 0 ? '$' : '-$'}{Math.abs(totalRevenue).toFixed(2)}
          </Text>
        )}
      </Card>

      <Card compact style={styles.dailyCard}>
        <SectionHeader title="Daily revenue" detail="Based on the current search and date filter." />
        {loading ? (
          <LoadingState label="Loading daily summary..." />
        ) : newestFirst.length === 0 ? (
          <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>No revenue data for this filter.</Text>
        ) : (
        <View style={styles.analyticsSection}>
          <View style={styles.dailyList}>
            {visibleDailyRevenue.map((item) => (
              <View key={item.date} style={styles.dailyRow}>
                <Text style={[styles.dailyDate, { color: theme.textSecondary }]}>{item.date}</Text>
                <Text style={[styles.dailyAmount, { color: item.value >= 0 ? theme.success : theme.danger }]}>
                  {item.value >= 0 ? '$' : '-$'}{Math.abs(item.value).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
          {newestFirst.length > 3 ? (
            <Button
              label={showAllDailyRevenue ? 'See less' : 'See more'}
              size="sm"
              variant="ghost"
              onPress={() => setShowAllDailyRevenue((current) => !current)}
            />
          ) : null}
        </View>
        )}
      </Card>

      <Card compact style={styles.chartCard}>
        <SectionHeader title="Revenue trend" detail="Latest days in this filtered sales view." />
        {loading ? (
          <LoadingState label="Loading revenue chart..." />
        ) : dailyData.length === 0 ? (
          <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>No chart data available.</Text>
        ) : (
          <View style={styles.analyticsSection}>
            <View style={styles.chartList}>
              {visibleRevenueTrend.map((item) => {
              const formattedDate = new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const width = `${Math.max(4, (Math.abs(item.value) / maximum) * 100)}%`;
              return (
                <View key={item.date} style={styles.chartRow}>
                  <Text style={[styles.chartDate, { color: theme.textSecondary }]}>{formattedDate}</Text>
                  <View style={[styles.chartTrack, { backgroundColor: theme.disabledSurface }]}>
                    <View style={[styles.chartBar, { width, backgroundColor: item.value >= 0 ? theme.success : theme.danger }]} />
                  </View>
                  <Text style={[styles.chartValue, { color: item.value >= 0 ? theme.success : theme.danger }]}>
                    {item.value >= 0 ? '$' : '-$'}{Math.abs(item.value).toFixed(0)}
                  </Text>
                </View>
              );
              })}
            </View>
            {dailyData.length > 3 ? (
              <Button
                label={showAllRevenueTrend ? 'See less' : 'See more'}
                size="sm"
                variant="ghost"
                onPress={() => setShowAllRevenueTrend((current) => !current)}
              />
            ) : null}
          </View>
        )}
      </Card>
    </View>
  );
}

function SaleForm({ products, productsLoading, productsError, productsHasMore, loadProducts, role, businessType, businessSettings, busy, onCancel, onSubmit }: { products: Product[]; productsLoading: boolean; productsError: string | null; productsHasMore: boolean; loadProducts: (search?: string, append?: boolean, force?: boolean) => Promise<void>; role: string | null; businessType: string; businessSettings: BusinessSettings; busy: boolean; onCancel: () => void; onSubmit: (input: SaleInput, receipt?: ReceiptData) => Promise<string | null> }) {
  const theme = useTheme();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [reference, setReference] = useState(() => `INV-${Date.now()}`);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+252');
  const [address, setAddress] = useState('');
  const [paid, setPaid] = useState(true);
  const [printAfterSale, setPrintAfterSale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState({ customer: false, phone: false });
  const [pendingAttempt, setPendingAttempt] = useState<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const timer = setTimeout(() => { void loadProducts(productSearch); }, 300);
    return () => clearTimeout(timer);
  }, [loadProducts, pickerOpen, productSearch]);

  const availableProducts = products.filter((product) => available(product, 'base', role, businessType) > 0 || available(product, 'converted', role, businessType) > 0);
  const normalizedProductSearch = productSearch.trim().toLowerCase();
  const filteredProducts = availableProducts.filter((product) =>
    !normalizedProductSearch ||
    product.name.toLowerCase().includes(normalizedProductSearch) ||
    product.category?.toLowerCase().includes(normalizedProductSearch) ||
    String(product.price ?? '').includes(normalizedProductSearch)
  );
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
    setCountryCode('+252');
    setAddress('');
    setPaid(true);
    setPrintAfterSale(false);
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
    const phoneInput = rawPhone.startsWith('+') ? rawPhone : `${countryCode}${rawPhone}`;
    const normalizedPhone = normalizePhoneNumber(phoneInput);
    if (rawPhone && !isPhoneNumber(normalizedPhone)) return setError('Please enter a valid phone number for the selected country.');
    setError(null);
    const orderReference = reference.trim() || `INV-${Date.now()}`;
    const saleInput = {
      items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity, unit: line.unit })),
      order_id: orderReference,
      customer_name: customer.trim() || undefined,
      customer_phone: rawPhone ? normalizedPhone : undefined,
      customer_address: address.trim() || undefined,
      paid,
    };
    const receipt: ReceiptData | undefined = printAfterSale ? {
      business: businessSettings,
      invoiceNumber: orderReference,
      date: new Date().toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' }),
      customerName: customer.trim() || 'Walk-in customer',
      customerPhone: normalizedPhone || undefined,
      customerAddress: address.trim() || undefined,
      items: cart.map((line): ReceiptLine => ({
        description: line.product.name,
        quantity: line.quantity,
        unit: unitLabel(line.product, line.unit),
        unitPrice: unitPrice(line.product, line.unit),
        total: lineSubtotal(line),
      })),
    } : undefined;
    const signature = JSON.stringify(saleInput);
    const idempotency_key = pendingAttempt?.signature === signature
      ? pendingAttempt.key
      : Crypto.randomUUID();
    setPendingAttempt({ signature, key: idempotency_key });
    const submitError = await onSubmit({ ...saleInput, idempotency_key }, receipt);
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
          <Button label="Add product" icon={<SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={theme.primaryText} size={18} />} fullWidth disabled={busy} onPress={() => { setPickerOpen((current) => !current); setProductSearch(''); setError(null); }} />
          {pickerOpen && (
            <View style={styles.inlinePicker}>
              <View style={styles.formHeader}>
                <SectionHeader title="Choose a product" detail="Search your catalog and set the quantity." />
                <Button label="Close" size="sm" variant="ghost" disabled={busy} onPress={() => setPickerOpen(false)} />
              </View>
              <Input label="Search products" value={productSearch} onChangeText={setProductSearch} placeholder="Product name" returnKeyType="search" editable={!busy} />
              {productsError ? <View style={styles.stateContent}><FeedbackMessage message={productsError} variant="error" /><Button label="Retry products" variant="secondary" disabled={busy} onPress={() => { void loadProducts(productSearch, products.length > 0 && productsHasMore, true); }} /></View> : null}
              {productsLoading && products.length === 0 ? <LoadingState label="Loading products..." /> : filteredProducts.length === 0 ? <EmptyState title="No matching products" description="Try another product name." /> : (
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
              {productsHasMore && !productsError ? <Button label="Load more products" variant="secondary" loading={productsLoading} disabled={busy || productsLoading} onPress={() => { void loadProducts(productSearch, true); }} /> : null}
            </View>
          )}
        </View>
        <Card compact style={styles.orderTotal}><Text style={[styles.saleMeta, { color: theme.textSecondary }]}>Order total</Text><Text style={[styles.total, { color: theme.text }]}>{money(cartTotal)}</Text></Card>
        <View style={styles.formGroup}><SectionHeader title="Reference" /><Input label="Reference" value={reference} onChangeText={setReference} placeholder="INV-..." editable={!busy} /></View>
        <View style={styles.formGroup}>
          <SectionHeader title="Customer" />
          <Input label="Customer name" value={customer} onChangeText={(value) => { setCustomer(value); setError(null); setInvalidFields((current) => ({ ...current, customer: false })); }} placeholder="Walk-in customer" error={invalidFields.customer ? 'Enter a customer name for an unpaid sale.' : undefined} editable={!busy} />
          <View style={styles.phoneField}>
            <Text style={[styles.factLabel, { color: theme.text }]}>Phone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryOptions}>
              {phoneCountryOptions.map((country) => (
                <Button
                  key={country.code}
                  label={`${country.flag} ${country.code}`}
                  size="sm"
                  variant={countryCode === country.code ? 'primary' : 'secondary'}
                  disabled={busy}
                  accessibilityLabel={`${country.country} ${country.code}`}
                  accessibilityState={{ selected: countryCode === country.code, disabled: busy }}
                  style={styles.countryCodeButton}
                  onPress={() => { setCountryCode(country.code); setError(null); }}
                />
              ))}
            </ScrollView>
            <Input
              label="Phone number"
              value={phone}
              onChangeText={(value) => { setPhone(value); setError(null); setInvalidFields((current) => ({ ...current, phone: false })); }}
              keyboardType="phone-pad"
              placeholder="Required for unpaid sales"
              helperText={`Saved as ${phone.trim().startsWith('+') ? normalizePhoneNumber(phone) : `${countryCode}${phone.replace(/[^\d]/g, '')}`}`}
              error={invalidFields.phone ? 'Enter a phone number for an unpaid sale.' : undefined}
              editable={!busy}
            />
          </View>
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
        <Button
          label={printAfterSale ? 'Print receipt after sale: On' : 'Print receipt after sale: Off'}
          variant={printAfterSale ? 'primary' : 'secondary'}
          icon={printAfterSale ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={theme.primaryText} size={16} /> : undefined}
          accessibilityState={{ selected: printAfterSale }}
          disabled={busy}
          onPress={() => setPrintAfterSale((current) => !current)}
        />
        <Button label="Complete sale" loading={busy} fullWidth disabled={cart.length === 0} onPress={submit} />
      </KeyboardAwareScrollView>

    </>
  );
}

export default function SalesScreen() {
  const theme = useTheme();
  const state = useSales();
  const [selected, setSelected] = useState<Sale | null>(null);
  const [returningSale, setReturningSale] = useState<Sale | null>(null);
  const [returnableQuantity, setReturnableQuantity] = useState<number | null>(null);
  const [returnQuantity, setReturnQuantity] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [pendingReturnAttempt, setPendingReturnAttempt] = useState<ReturnAttempt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const returnLookupSequence = useRef(0);
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [busy, setBusy] = useState(false);
  const canCreate = state.role === 'owner' || state.role === 'sales';
  const openSale = () => {
    setFormSession((current) => current + 1);
    setFormOpen(true);
    void state.loadProducts('', false, true);
  };
  const submit = async (input: SaleInput, receipt?: ReceiptData): Promise<string | null> => {
    setBusy(true);
    try {
      const error = await state.createSale(input);
      if (error) return error;
      setFormOpen(false);
      if (receipt) {
        try {
          await Print.printAsync({ html: createReceiptHtml(receipt) });
          setReceiptError(null);
        } catch (printError) {
          setReceiptError(`Sale completed, but the receipt could not be printed: ${printError instanceof Error ? printError.message : 'Unknown print error'}`);
        }
      }
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openReturn = async (sale: Sale) => {
    if (!sale.product_id) {
      setReturnError('This sale has no product reference, so it cannot be returned from mobile.');
      setReturningSale(sale);
      setReturnableQuantity(0);
      return;
    }

    setSelected(null);
    setReturningSale(sale);
    setReturnableQuantity(null);
    setReturnQuantity('');
    setReturnReason('');
    setReturnError(null);
    setPendingReturnAttempt(null);
    const requestId = ++returnLookupSequence.current;
    setReturnLoading(true);
    try {
      const rows = sale.order_id
        ? await state.loadSalesByReference(sale.order_id)
        : state.sales;
      const exactInvoiceRows = sale.order_id
        ? rows.filter((row) => row.order_id === sale.order_id)
        : rows;
      if (requestId !== returnLookupSequence.current) return;
      const remaining = remainingReturnQuantity(sale, exactInvoiceRows);
      setReturnableQuantity(remaining);
      if (remaining <= 0) setReturnError('There is no quantity remaining to return for this sale.');
    } catch (loadError) {
      if (requestId === returnLookupSequence.current) {
        setReturnError(loadError instanceof Error ? loadError.message : 'Unable to verify the remaining return quantity.');
      }
    } finally {
      if (requestId === returnLookupSequence.current) setReturnLoading(false);
    }
  };

  const closeReturn = () => {
    if (returnSaving) return;
    returnLookupSequence.current += 1;
    setReturnLoading(false);
    setReturningSale(null);
  };

  const saveReturn = async () => {
    if (!returningSale?.product_id || returnableQuantity === null) return;
    const quantity = Number(returnQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setReturnError('Enter a whole-number return quantity greater than zero.');
      return;
    }
    if (quantity > returnableQuantity) {
      setReturnError(`Return quantity cannot exceed ${returnableQuantity}.`);
      return;
    }

    const payload: Omit<ReturnInput, 'idempotency_key'> = {
      items: [{
        product_id: returningSale.product_id,
        quantity,
        unit: returningSale.unit === 'converted' ? 'converted' : 'base',
      }],
      order_id: returningSale.order_id || undefined,
      customer_name: returningSale.customer_name || undefined,
      customer_phone: returningSale.customer_phone || undefined,
      customer_address: returningSale.customer_address || undefined,
      type: 'return',
      refund_reason: returnReason.trim() || undefined,
    };
    const signature = JSON.stringify(payload);
    const idempotencyKey = pendingReturnAttempt?.signature === signature
      ? pendingReturnAttempt.key
      : Crypto.randomUUID();
    setPendingReturnAttempt({ signature, key: idempotencyKey });
    setReturnSaving(true);
    setReturnError(null);
    try {
      const error = await state.recordReturn({ ...payload, idempotency_key: idempotencyKey });
      if (error) {
        setReturnError(error);
        return;
      }
      setReturningSale(null);
      setPendingReturnAttempt(null);
    } finally {
      setReturnSaving(false);
    }
  };

  const runSaleReceipt = async (sale: Sale) => {
    setReceiptLoading(true);
    setReceiptError(null);
    try {
      const rows = sale.order_id
        ? await state.loadSalesByReference(sale.order_id)
        : [sale];
      const exactInvoiceSales = sale.order_id
        ? rows.filter((row) => row.order_id === sale.order_id && row.type !== 'return')
        : [sale];
      const receipt = getSaleReceipt(exactInvoiceSales, sale, state.businessSettings);
      const html = createReceiptHtml(receipt);

      await Print.printAsync({ html });
    } catch (receiptActionError) {
      setReceiptError(receiptActionError instanceof Error ? receiptActionError.message : 'Unable to create the sale receipt.');
    } finally {
      setReceiptLoading(false);
    }
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
              {receiptError ? <FeedbackMessage message={receiptError} variant="error" /> : null}
              <View style={styles.dateFilter}>
                <SectionHeader title="Filter by date" detail="Enter a date in YYYY-MM-DD format." />
                <Input label="Sale date" value={state.date} onChangeText={state.setDate} placeholder="YYYY-MM-DD" accessibilityHint="Filters sales by the date entered" />
                <View style={styles.dateActions}><Button label="Clear filters" size="sm" variant="ghost" accessibilityHint="Clears the sales search and date filters" onPress={() => { state.setSearch(''); state.setDate(''); }} /></View>
              </View>
              <SalesAnalytics sales={state.sales} loading={state.loading} />
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
              {selected.refund_reason ? <DetailRow label="Return reason" value={selected.refund_reason} /> : null}
            </Card>
            {receiptError ? <FeedbackMessage message={receiptError} variant="error" /> : null}
            {selected.type !== 'return' && (
              <View style={styles.detailActions}>
                <Button
                  label="Print receipt"
                  variant="secondary"
                  loading={receiptLoading}
                  disabled={receiptLoading}
                  onPress={() => void runSaleReceipt(selected)}
                />
                {canCreate && selected.product_id ? (
                  <Button
                    label="Return item"
                    variant="warning"
                    disabled={receiptLoading}
                    onPress={() => void openReturn(selected)}
                  />
                ) : null}
              </View>
            )}
          </>}
        </ScrollView>
      </Modal>

      <Modal visible={returningSale !== null} animationType="slide" onRequestClose={closeReturn}>
        <ScrollView style={[styles.detailScroll, { backgroundColor: theme.background }]} contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <SectionHeader title="Return sale item" detail="Returned quantities are added back to inventory." />
            <Button label="Close" size="sm" variant="ghost" disabled={returnSaving} onPress={closeReturn} />
          </View>
          {returningSale && (
            <Card compact style={styles.detailCard}>
              <DetailRow label="Product" value={returningSale.product_name || 'Unknown product'} />
              <DetailRow label="Invoice" value={returningSale.order_id || 'No reference'} />
              <DetailRow label="Customer" value={returningSale.customer_name || 'Walk-in customer'} />
              <DetailRow label="Sold quantity" value={`${returningSale.quantity || 0} ${returningSale.quantity_unit || 'unit'}`} />
              {returnLoading
                ? <LoadingState label="Checking returnable quantity..." />
                : <DetailRow label="Remaining returnable" value={`${returnableQuantity ?? 0} ${returningSale.quantity_unit || 'unit'}`} />}
            </Card>
          )}
          {returnError ? <FeedbackMessage message={returnError} variant="error" /> : null}
          <Input
            label="Quantity to return"
            value={returnQuantity}
            onChangeText={(value) => { setReturnQuantity(value); setReturnError(null); }}
            placeholder="Enter whole-number quantity"
            keyboardType="number-pad"
            editable={!returnLoading && !returnSaving && (returnableQuantity ?? 0) > 0}
            helperText={returnableQuantity === null ? 'The available quantity is being checked.' : `Enter a quantity from 1 to ${returnableQuantity}.`}
          />
          <Input
            label="Return reason (optional)"
            value={returnReason}
            onChangeText={setReturnReason}
            placeholder="Describe why the item is being returned"
            multiline
            textAlignVertical="top"
            style={styles.reasonInput}
            editable={!returnSaving}
          />
          <View style={styles.returnActions}>
            <Button label="Cancel" variant="ghost" disabled={returnSaving} onPress={closeReturn} />
            <Button
              label="Confirm return"
              variant="warning"
              loading={returnSaving}
              disabled={returnLoading || returnableQuantity === null || returnableQuantity <= 0}
              onPress={() => void saveReturn()}
            />
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={formOpen} animationType="slide" onRequestClose={() => { if (!busy) setFormOpen(false); }}>
        <View style={[styles.saleModal, { backgroundColor: theme.background }]}>
          <SaleForm key={formSession} products={state.products} productsLoading={state.productsLoading} productsError={state.productsError} productsHasMore={state.productsHasMore} loadProducts={state.loadProducts} role={state.role} businessType={state.businessType} businessSettings={state.businessSettings} busy={busy} onCancel={() => !busy && setFormOpen(false)} onSubmit={submit} />
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
  modal: { flexGrow: 1, padding: Layout.pagePadding, paddingTop: Spacing.xl, gap: Spacing.lg }, detailScroll: { flex: 1 }, saleModal: { flex: 1 }, form: { gap: Spacing.xl, paddingBottom: Spacing.xxl }, formGroup: { gap: Spacing.md }, formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md }, detailActions: { gap: Spacing.sm }, returnActions: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md }, reasonInput: { minHeight: 112, paddingTop: Spacing.md },
  phoneField: { gap: Spacing.sm },
  countryOptions: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  countryCodeButton: { minWidth: 76 },
  analytics: { gap: Spacing.md }, analyticsSection: { gap: Spacing.sm }, revenueCard: { gap: Spacing.xs }, revenueValue: { ...Typography.screenTitle, marginTop: Spacing.xs }, analyticsLabel: { ...Typography.label }, dailyCard: { gap: Spacing.md }, dailyList: { gap: Spacing.sm }, dailyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }, dailyDate: { ...Typography.caption }, dailyAmount: { ...Typography.label },
  chartCard: { gap: Spacing.md }, chartList: { gap: Spacing.sm }, chartRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, chartDate: { ...Typography.caption, width: 54 }, chartTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' }, chartBar: { height: '100%', borderRadius: 999 }, chartValue: { ...Typography.caption, width: 58, textAlign: 'right' },
  cartLines: { gap: Spacing.md }, cartLine: { gap: Spacing.md }, cartLineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }, cartLineCopy: { flex: 1, gap: Spacing.xs }, iconButton: { width: ControlHeights.standard, height: ControlHeights.standard, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }, cartLineFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.md }, quantityControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, quantityButton: { width: ControlHeights.standard, height: ControlHeights.standard, borderWidth: 1, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }, quantityValue: { ...Typography.sectionTitle, minWidth: 32, textAlign: 'center' }, subtotalCopy: { alignItems: 'flex-end', gap: Spacing.xxs }, lineSubtotal: { ...Typography.label }, orderTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }, inlinePicker: { gap: Spacing.lg, marginTop: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#cbd5e1' }, productResults: { gap: Spacing.sm }, productOption: { minHeight: ControlHeights.large, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, copy: { flex: 1, gap: Spacing.xxs }, selectedCard: { gap: Spacing.md }, unitRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }, total: { ...Typography.sectionTitle }, detailName: { ...Typography.screenTitle, marginBottom: Spacing.sm }, detailCard: { gap: Spacing.md }, detailRow: { gap: Spacing.xxs, paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth }, detailLabel: { ...Typography.caption }, detailValue: { ...Typography.body },
});