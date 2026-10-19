import { useCallback, useEffect, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { callWebApi } from '@/lib/web-api';
import { supabase } from '@/lib/supabase';

type ReportFilter = '7d' | '30d' | 'all';
type Sale = { id: string; product_name?: string | null; quantity?: number | null; quantity_unit?: string | null; unit?: string | null; total?: number | null; type?: 'sale' | 'return' | null; order_id?: string | null; customer_name?: string | null; user_email?: string | null; user_id?: string | null; created_at?: string | null; };
type ProductMetric = { product_id: string; product_name: string; stock_loaded: number; started: number | null; sold: number; returned: number; remaining: number; base_unit?: string | null; converted_unit?: string | null; conversion_rate?: number | null; sold_unit_mode?: string; };

type ReportData = {
  role: TenantRole | null;
  filter: ReportFilter;
  sales: Sale[];
  metrics: ProductMetric[];
  revenue: number;
  orders: number;
  average: number;
  latestSale: Date | null;
  topProduct: string | null;
  perUser: { name: string; total: number }[];
  perProduct: { name: string; quantity: number; unit: string | null }[];
};

type ReportSalesSummary = Pick<ReportData, 'sales' | 'revenue' | 'orders' | 'average' | 'latestSale' | 'topProduct' | 'perUser' | 'perProduct'>;

export type ReportsState = { data: ReportData | null; filter: ReportFilter; setFilter: (filter: ReportFilter) => void; loading: boolean; error: string | null; refresh: () => void; };

function safeDate(value: string | null | undefined) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function inFilter(sale: Sale, filter: ReportFilter) { const date = safeDate(sale.created_at); if (!date) return false; if (filter === 'all') return true; return (Date.now() - date.getTime()) / 86400000 <= (filter === '7d' ? 7 : 30); }
function saleRevenue(sale: Sale) {
  const amount = Number(sale.total || 0);
  return sale.type === 'return' ? -Math.abs(amount) : amount;
}
function saleQuantity(sale: Sale) {
  const quantity = Number(sale.quantity || 0);
  return sale.type === 'return' ? -Math.abs(quantity) : quantity;
}

async function loadReportSales(filter: ReportFilter, tenantId: string): Promise<ReportSalesSummary> {
  const pageSize = 1000;
  const since = filter === 'all'
    ? null
    : new Date(Date.now() - (filter === '7d' ? 7 : 30) * 86400000).toISOString();
  const recentSales: Sale[] = [];
  const seenIds = new Set<string>();
  const productTotals = new Map<string, number>();
  const userTotals = new Map<string, number>();
  const productQuantities = new Map<string, { quantity: number; unit: string | null }>();
  let revenue = 0;
  let orders = 0;
  let offset = 0;

  while (true) {
    let query = supabase
      .from('sales')
      .select('id, product_name, quantity, quantity_unit, unit, total, type, order_id, customer_name, user_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (since) query = query.gte('created_at', since);

    const { data: page, error } = await query;
    if (error) throw new Error(`Unable to load report sales: ${error.message}`);
    if (!Array.isArray(page)) throw new Error('The sales service returned an invalid report response.');
    for (const sale of page) {
      if (!sale || typeof sale.id !== 'string' || seenIds.has(sale.id)) {
        throw new Error('Sales pagination returned duplicate or invalid records. Refresh the report or contact support.');
      }
      seenIds.add(sale.id);
      if (!inFilter(sale, filter)) continue;

      const name = sale.product_name || 'Unknown';
      const quantity = saleQuantity(sale);
      revenue += saleRevenue(sale);
      if (sale.type !== 'return') orders += 1;
      productTotals.set(name, (productTotals.get(name) || 0) + quantity);
      const user = sale.user_id || 'unknown';
      userTotals.set(user, (userTotals.get(user) || 0) + saleRevenue(sale));
      const current = productQuantities.get(name) || { quantity: 0, unit: sale.quantity_unit || null };
      current.quantity += quantity;
      current.unit ||= sale.quantity_unit || null;
      productQuantities.set(name, current);

      if (recentSales.length < 10) recentSales.push(sale);
    }
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return {
    sales: recentSales,
    revenue,
    orders,
    average: orders ? revenue / orders : 0,
    latestSale: safeDate(recentSales[0]?.created_at),
    topProduct: [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    perUser: [...userTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total })),
    perProduct: [...productQuantities.entries()].sort((a, b) => b[1].quantity - a[1].quantity).map(([name, value]) => ({ name, ...value })),
  };
}

export function useReports(): ReportsState {
  const { user, loading: authLoading } = useAuth();
  const { role, tenantId, loading: roleLoading } = useTenantRole();
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user || !tenantId || role === 'sales') return () => { mounted = false; };
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [salesSummary, metrics] = await Promise.all([
          loadReportSales(filter, tenantId),
          callWebApi<ProductMetric[]>(`/api/reports/product-metrics?filter=${filter}`),
        ]);
        const nextData: ReportData = {
          role,
          filter,
          metrics: metrics || [],
          ...salesSummary,
        };
        if (mounted) setData(nextData);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [attempt, authLoading, filter, role, roleLoading, tenantId, user]);

  return { data, filter, setFilter, loading: loading || authLoading || roleLoading, error, refresh };
}

export type { ProductMetric, ReportFilter, Sale };
