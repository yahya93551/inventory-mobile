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
          callWebApi<Sale[]>('/api/sales?limit=100'),
          callWebApi<ProductMetric[]>(`/api/reports/product-metrics?filter=${filter}`),
        ]);
        const filtered = (sales || []).filter((sale) => inFilter(sale, filter));
        const revenue = filtered.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
        const productTotals = new Map<string, number>();
        const userTotals = new Map<string, number>();
        const productQuantities = new Map<string, { quantity: number; unit: string | null }>();
        for (const sale of filtered) {
          const name = sale.product_name || 'Unknown';
          productTotals.set(name, (productTotals.get(name) || 0) + Number(sale.quantity || 0));
          const user = sale.user_email || sale.user_id || 'unknown';
          userTotals.set(user, (userTotals.get(user) || 0) + Number(sale.total || 0));
          const current = productQuantities.get(name) || { quantity: 0, unit: sale.quantity_unit || null };
          current.quantity += Number(sale.quantity || 0);
          current.unit ||= sale.quantity_unit || null;
          productQuantities.set(name, current);
        }
        const nextData: ReportData = {
          role, filter, sales: filtered, metrics: metrics || [], revenue, orders: filtered.length,
          average: filtered.length ? revenue / filtered.length : 0,
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
