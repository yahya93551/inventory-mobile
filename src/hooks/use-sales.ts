import { useCallback, useEffect, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { supabase } from '@/lib/supabase';
import { callWebApi } from '@/lib/web-api';

type Sale = {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  quantity_unit?: string | null;
  unit?: 'base' | 'converted' | null;
  total?: number | null;
  type?: 'sale' | 'return' | null;
  order_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  paid?: boolean | null;
  created_at?: string | null;
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  stock: number | null;
  base_unit?: string | null;
  converted_unit?: string | null;
  conversion_rate?: number | null;
  stock_remainder?: number | null;
  allocated_quantity?: number;
};

type SaleInput = {
  product_id: string;
  quantity: number;
  unit?: 'base' | 'converted';
  order_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  paid?: boolean;
};

export type SalesState = {
  role: TenantRole | null;
  businessType: string;
  sales: Sale[];
  products: Product[];
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  refresh: () => void;
  createSale: (input: SaleInput) => Promise<string | null>;
};

function applySearch(query: any, search: string) {
  const value = search.trim();
  if (!value) return query;
  const escaped = value.replace(/[,]/g, ' ');
  return query.or(`product_name.ilike.%${escaped}%,order_id.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,customer_phone.ilike.%${escaped}%`);
}

export function useSales(): SalesState {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useTenantRole();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [businessType, setBusinessType] = useState('custom');
  const [search, setSearchState] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const setSearch = useCallback((value: string) => setSearchState(value), []);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user) return () => { mounted = false; };

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        let salesQuery = supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(100);
        if (role === 'sales') salesQuery = salesQuery.eq('user_id', user.id);
        salesQuery = applySearch(salesQuery, search);
        if (date) {
          salesQuery = salesQuery.gte('created_at', `${date}T00:00:00.000Z`).lt('created_at', `${date}T23:59:59.999Z`);
        }

        let productsQuery = supabase.from('products').select('id,name,category,price,stock,base_unit,converted_unit,conversion_rate,stock_remainder').order('created_at', { ascending: false }).limit(100);
        const [salesResult, productsResult, settingsResult, takesResult] = await Promise.all([
          salesQuery,
          productsQuery,
          supabase.from('business_settings').select('business_type').maybeSingle(),
          role === 'sales' ? supabase.from('inventory_takes').select('product_id,remaining_quantity').eq('user_id', user.id).gt('remaining_quantity', 0) : Promise.resolve({ data: [], error: null }),
        ]);
        if (salesResult.error) throw new Error(salesResult.error.message);
        if (productsResult.error) throw new Error(productsResult.error.message);
        if (settingsResult.error) throw new Error(settingsResult.error.message);
        if (takesResult.error) throw new Error(takesResult.error.message);
        if (mounted) {
          setSales((salesResult.data || []) as Sale[]);
          setBusinessType(settingsResult.data?.business_type || 'custom');
          const allocations = new Map<string, number>();
          for (const take of takesResult.data || []) {
            if (take.product_id) allocations.set(take.product_id, (allocations.get(take.product_id) || 0) + Number(take.remaining_quantity || 0));
          }
          setProducts((productsResult.data || []).map((product) => ({ ...product, allocated_quantity: allocations.get(product.id) || 0 })) as Product[]);
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load sales.');
      } finally {
        if (mounted) setLoading(false);
      }
    }, 300);

    return () => { mounted = false; clearTimeout(timer); };
  }, [attempt, authLoading, role, roleLoading, user, search, date]);

  const createSale = useCallback(async (input: SaleInput) => {
    try {
      await callWebApi('/api/sales', { method: 'POST', body: JSON.stringify(input) });
      refresh();
      return null;
    } catch (createError) {
      return createError instanceof Error ? createError.message : 'Unable to complete sale.';
    }
  }, [refresh]);

  return { role, businessType, sales, products, loading: loading || authLoading || roleLoading, error, search, setSearch, date, setDate, refresh, createSale };
}

export type { Product, Sale, SaleInput };
