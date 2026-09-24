import { useCallback, useEffect, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { supabase } from '@/lib/supabase';

type ProductRow = {
  id: string;
  name: string;
  category?: string | null;
  cost_price?: number | null;
  price?: number | null;
  stock?: number | null;
  base_unit?: string | null;
  converted_unit?: string | null;
};

type SaleRow = {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  total?: number | null;
  type?: 'sale' | 'return' | null;
  created_at?: string | null;
  quantity_unit?: string | null;
  quantity_unit_name?: string | null;
  unit?: 'base' | 'converted' | null;
  order_id?: string | null;
  customer_name?: string | null;
};

type TrendPoint = { date: string; total: number };
type RecentSale = SaleRow & { productName: string; date: Date | null };

export type DashboardData = {
  role: TenantRole | null;
  products: ProductRow[];
  sales: RecentSale[];
  categories: string[];
  totalProducts: number;
  categoryCount: number;
  totalCost: number;
  totalSellValue: number;
  potentialProfit: number;
  netRevenue: number;
  totalSales: number;
  averageSale: number;
  salesThisMonth: number;
  lastSaleDate: Date | null;
  trend: TrendPoint[];
  topProduct: { name: string; revenue: number; share: number } | null;
  costPriceVisible: boolean;
  priceVisible: boolean;
  businessType: string;
  ownerMetrics: {
    takenNotSoldTotal: number;
    takenNotSoldCount: number;
    unpaidDebtsTotal: number;
    unpaidDebtsCount: number;
  } | null;
};

type DashboardState = {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

const fallbackVisibleFields = new Set(['name', 'category', 'cost_price', 'price', 'stock']);

function getSaleDate(sale: SaleRow) {
  if (!sale.created_at) return null;
  const date = new Date(sale.created_at);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getProductName(sale: SaleRow) {
  return sale.product_name || 'Unknown';
}

function getDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDashboardData({
  role,
  products,
  sales,
  categories,
  visibleFields,
  businessType,
  ownerMetrics,
}: {
  role: TenantRole | null;
  products: ProductRow[];
  sales: SaleRow[];
  categories: string[];
  visibleFields: Set<string>;
  businessType: string;
  ownerMetrics: DashboardData['ownerMetrics'];
}): DashboardData {
  const totalCost = products.reduce((sum, product) => sum + Number(product.cost_price || 0) * Number(product.stock || 0), 0);
  const totalSellValue = products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0);
  const now = new Date();
  const salesWithDates = sales.map((sale) => ({ ...sale, productName: getProductName(sale), date: getSaleDate(sale) }));
  const salesOverview = salesWithDates.reduce(
    (summary, sale) => {
      const saleType = sale.type ?? 'sale';
      const amount = Number(sale.total || 0);
      const value = saleType === 'return' ? -amount : amount;
      summary.netRevenue += value;
      if (saleType !== 'return') summary.totalSales += 1;
      if (sale.date && sale.date.getFullYear() === now.getFullYear() && sale.date.getMonth() === now.getMonth()) {
        summary.salesThisMonth += 1;
      }
      return summary;
    },
    { netRevenue: 0, totalSales: 0, salesThisMonth: 0 },
  );

  const trendMap = new Map<string, number>();
  const revenueByProduct = new Map<string, number>();
  for (const sale of salesWithDates) {
    const amount = Number(sale.total || 0);
    const value = sale.type === 'return' ? -amount : amount;
    if (sale.date) trendMap.set(getDayKey(sale.date), (trendMap.get(getDayKey(sale.date)) || 0) + value);
    revenueByProduct.set(sale.productName, (revenueByProduct.get(sale.productName) || 0) + value);
  }

  const topRevenue = [...revenueByProduct.entries()].sort((a, b) => b[1] - a[1])[0];
  const trend = [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));

  return {
    role,
    products,
    sales: salesWithDates,
    categories,
    totalProducts: products.length,
    categoryCount: categories.length > 0 ? categories.length : new Set(products.map((product) => product.category).filter(Boolean)).size,
    totalCost,
    totalSellValue,
    potentialProfit: Math.max(0, totalSellValue - totalCost),
    netRevenue: salesOverview.netRevenue,
    totalSales: salesOverview.totalSales,
    averageSale: salesOverview.totalSales > 0 ? salesOverview.netRevenue / salesOverview.totalSales : 0,
    salesThisMonth: salesOverview.salesThisMonth,
    lastSaleDate: salesWithDates[0]?.date ?? null,
    trend,
    topProduct: topRevenue ? { name: topRevenue[0], revenue: topRevenue[1], share: salesOverview.netRevenue > 0 ? (topRevenue[1] / salesOverview.netRevenue) * 100 : 0 } : null,
    costPriceVisible: visibleFields.has('cost_price'),
    priceVisible: visibleFields.has('price'),
    businessType,
    ownerMetrics,
  };
}

export function useDashboard(): DashboardState {
  const { user, loading: authLoading } = useAuth();
  const { role, tenantId, loading: roleLoading } = useTenantRole();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user) return () => { mounted = false; };

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const [productsResult, salesResult, categoriesResult, fieldsResult, settingsResult] = await Promise.all([
          supabase.from('products').select('*').order('created_at', { ascending: false }),
          supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('categories').select('name').order('name', { ascending: true }),
          supabase.from('custom_fields').select('field_name,is_visible,is_system,field_order').eq('is_system', true).order('field_order', { ascending: true }),
          supabase.from('business_settings').select('business_type').maybeSingle(),
        ]);

        const firstError = [productsResult.error, salesResult.error, categoriesResult.error, settingsResult.error].find(Boolean);
        if (firstError) throw new Error(firstError.message);

        const visibleFields = fieldsResult.error || !fieldsResult.data?.length
          ? fallbackVisibleFields
          : new Set(fieldsResult.data.filter((field) => field.is_visible).map((field) => field.field_name));
        let ownerMetrics: DashboardData['ownerMetrics'] = null;

        if (role === 'owner' && tenantId) {
          const [takesResult, debtsResult] = await Promise.all([
            supabase.from('inventory_takes').select('remaining_quantity').eq('tenant_id', tenantId).gt('remaining_quantity', 0),
            supabase.from('debts').select('amount').eq('tenant_id', tenantId).eq('paid', false),
          ]);
          if (takesResult.error) throw new Error(takesResult.error.message);
          if (debtsResult.error) throw new Error(debtsResult.error.message);
          ownerMetrics = {
            takenNotSoldTotal: (takesResult.data || []).reduce((sum, item) => sum + Number(item.remaining_quantity || 0), 0),
            takenNotSoldCount: takesResult.data?.length || 0,
            unpaidDebtsTotal: (debtsResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
            unpaidDebtsCount: debtsResult.data?.length || 0,
          };
        }

        const nextData = buildDashboardData({
          role,
          products: (productsResult.data || []) as ProductRow[],
          sales: (salesResult.data || []) as SaleRow[],
          categories: (categoriesResult.data || []).map((category) => category.name).filter(Boolean),
          visibleFields,
          businessType: settingsResult.data?.business_type || 'custom',
          ownerMetrics,
        });
        if (mounted) setData(nextData);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDashboard();
    return () => { mounted = false; };
  }, [attempt, authLoading, role, roleLoading, tenantId, user]);

  return { data, loading: loading || authLoading || roleLoading, error, retry };
}