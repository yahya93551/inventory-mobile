import { useCallback, useEffect, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { callWebApi } from '@/lib/web-api';

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

async function loadReportSales(filter: ReportFilter): Promise<Sale[]> {
  const pageSize = 100;
  const since = filter === 'all'
    ? null
    : new Date(Date.now() - (filter === '7d' ? 7 : 30) * 86400000).toISOString();
  const sales: Sale[] = [];
  const seenIds = new Set<string>();
  let offset = 0;

  while (true) {
    const sinceParam = since ? `&since=${encodeURIComponent(since)}` : '';
    const page = await callWebApi<Sale[]>(`/api/sales?limit=${pageSize}&offset=${offset}${sinceParam}`);
    if (!Array.isArray(page)) throw new Error('The sales service returned an invalid report response.');
    if (page.length > pageSize) throw new Error('The sales service returned an invalid report page.');
    for (const sale of page) {
      if (!sale || typeof sale.id !== 'string' || seenIds.has(sale.id)) {
        throw new Error('Sales pagination returned duplicate or invalid records. Refresh the report or contact support.');
      }
      seenIds.add(sale.id);
    }
    sales.push(...page);
    if (page.length < pageSize) return sales;
    offset += pageSize;
  }
}

export function useReports(): ReportsState {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useTenantRole();
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user || role === 'sales') return () => { mounted = false; };
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sales, metrics] = await Promise.all([
          loadReportSales(filter),
          callWebApi<ProductMetric[]>(`/api/reports/product-metrics?filter=${filter}`),
        ]);
        const filtered = (sales || []).filter((sale) => inFilter(sale, filter));
        const revenue = filtered.reduce((sum, sale) => sum + saleRevenue(sale), 0);
        const orders = filtered.filter((sale) => sale.type !== 'return').length;
        const productTotals = new Map<string, number>();
        const userTotals = new Map<string, number>();
        const productQuantities = new Map<string, { quantity: number; unit: string | null }>();
        for (const sale of filtered) {
          const name = sale.product_name || 'Unknown';
          const quantity = saleQuantity(sale);
          productTotals.set(name, (productTotals.get(name) || 0) + quantity);
          const user = sale.user_email || sale.user_id || 'unknown';
          userTotals.set(user, (userTotals.get(user) || 0) + saleRevenue(sale));
          const current = productQuantities.get(name) || { quantity: 0, unit: sale.quantity_unit || null };
          current.quantity += quantity;
          current.unit ||= sale.quantity_unit || null;
          productQuantities.set(name, current);
        }
        const nextData: ReportData = {
          role, filter, sales: filtered, metrics: metrics || [], revenue, orders,
          average: orders ? revenue / orders : 0,
          latestSale: safeDate(filtered[0]?.created_at),
          topProduct: [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
          perUser: [...userTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total })),
          perProduct: [...productQuantities.entries()].sort((a, b) => b[1].quantity - a[1].quantity).map(([name, value]) => ({ name, ...value })),
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
  }, [attempt, authLoading, filter, role, roleLoading, user]);

  return { data, filter, setFilter, loading: loading || authLoading || roleLoading, error, refresh };
}

export type { ProductMetric, ReportFilter, Sale };
