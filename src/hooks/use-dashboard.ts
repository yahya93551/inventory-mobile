import { useCallback, useEffect, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { supabase } from '@/lib/supabase';
import { callWebApi } from '@/lib/web-api';

type ProductSummary = { totalProducts: number; totalCost: number; totalSellValue: number; categoryCount: number };
type ProductPageRow = { id: string; category?: string | null; cost_price?: number | null; price?: number | null; stock?: number | null };

type SaleRow = {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  total?: number | null;
  type?: 'sale' | 'return' | null;
  created_at?: string | null;
  quantity_unit?: string | null;
  unit?: 'base' | 'converted' | null;
  order_id?: string | null;
  customer_name?: string | null;
};

type TrendPoint = { date: string; total: number };
type RecentSale = SaleRow & { productName: string; date: Date | null };
type OwnerMetricsResponse = {
  taken_not_sold_total: number;
  taken_not_sold_count: number;
  unpaid_debts_total: number;
  unpaid_debts_count: number;
};

export type DashboardData = {
  role: TenantRole | null;
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
    available: boolean;
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
const dashboardProductPageSize = 500;

async function loadProductSummary(): Promise<ProductSummary> {
  let cursor: string | null = null;
  let totalProducts = 0;
  let totalCost = 0;
  let totalSellValue = 0;
  const productCategories = new Set<string>();

  while (true) {
    let query = supabase
      .from('products')
      .select('id,category,cost_price,price,stock')
      .order('id', { ascending: true })
      .limit(dashboardProductPageSize);
    if (cursor) {
      query = query.gt('id', cursor);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data || []) as ProductPageRow[];
    for (const product of rows) {
      const stock = Number(product.stock || 0);
      totalProducts += 1;
      totalCost += Number(product.cost_price || 0) * stock;
      totalSellValue += Number(product.price || 0) * stock;
      if (product.category) productCategories.add(product.category);
    }

    if (rows.length < dashboardProductPageSize) break;
    cursor = rows[rows.length - 1].id;
  }

  return { totalProducts, totalCost, totalSellValue, categoryCount: productCategories.size };
}

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
  productSummary,
  sales,
  categories,
  visibleFields,
  businessType,
  ownerMetrics,
}: {
  role: TenantRole | null;
  productSummary: ProductSummary;
  sales: SaleRow[];
  categories: string[];
  visibleFields: Set<string>;
  businessType: string;
  ownerMetrics: DashboardData['ownerMetrics'];
}): DashboardData {
  const totalCost = productSummary.totalCost;
  const totalSellValue = productSummary.totalSellValue;
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
    sales: salesWithDates,
    categories,
    totalProducts: productSummary.totalProducts,
    categoryCount: categories.length > 0 ? categories.length : productSummary.categoryCount,
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
        const [productSummary, salesResult, categoriesResult, fieldsResult, settingsResult] = await Promise.all([
          loadProductSummary(),
          supabase.from('sales').select('id,product_name,quantity,total,type,created_at,quantity_unit').order('created_at', { ascending: false }).limit(100),
          supabase.from('categories').select('name').order('name', { ascending: true }),
          supabase.from('custom_fields').select('field_name,is_visible,is_system,field_order').eq('is_system', true).order('field_order', { ascending: true }),
          supabase.from('business_settings').select('business_type').maybeSingle(),
        ]);

        const firstError = [salesResult.error, categoriesResult.error, settingsResult.error].find(Boolean);
        if (firstError) throw new Error(firstError.message);

        const visibleFields = fieldsResult.error || !fieldsResult.data?.length
          ? fallbackVisibleFields
          : new Set(fieldsResult.data.filter((field) => field.is_visible).map((field) => field.field_name));
        let ownerMetrics: DashboardData['ownerMetrics'] = null;

        if (role === 'owner' && tenantId) {
          try {
            const metrics = await callWebApi<OwnerMetricsResponse>('/api/analytics/owner-metrics');
            ownerMetrics = {
              available: true,
              takenNotSoldTotal: Number(metrics.taken_not_sold_total || 0),
              takenNotSoldCount: Number(metrics.taken_not_sold_count || 0),
              unpaidDebtsTotal: Number(metrics.unpaid_debts_total || 0),
              unpaidDebtsCount: Number(metrics.unpaid_debts_count || 0),
            };
          } catch {
            ownerMetrics = { available: false, takenNotSoldTotal: 0, takenNotSoldCount: 0, unpaidDebtsTotal: 0, unpaidDebtsCount: 0 };
          }
        }

        const nextData = buildDashboardData({
          role,
          productSummary,
          sales: (salesResult.data || []) as SaleRow[],
          categories: (categoriesResult.data || []).map((category) => category.name).filter(Boolean),
          visibleFields,
          businessType: settingsResult.data?.business_type || 'custom',
          ownerMetrics,
        });
        if (mounted) setData(nextData);
      } catch {
        if (mounted) setError('Unable to load dashboard data. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDashboard();
    return () => { mounted = false; };
  }, [attempt, authLoading, role, roleLoading, tenantId, user]);

  return { data, loading: loading || authLoading || roleLoading, error, retry };
}