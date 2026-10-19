import { useCallback, useEffect, useRef, useState } from 'react';

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
  allocation_availability?: {
    base_quantity: number;
    converted_quantity: number;
    converted_unit: string | null;
    conversion_rate: number | null;
  };
};

type SaleItemInput = {
  product_id: string;
  quantity: number;
  unit?: 'base' | 'converted';
};

type SaleInput = {
  idempotency_key: string;
  items: SaleItemInput[];
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
  productsLoading: boolean;
  productsError: string | null;
  productsHasMore: boolean;
  loadProducts: (search?: string, append?: boolean, force?: boolean) => Promise<void>;
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
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [businessType, setBusinessType] = useState('custom');
  const [search, setSearchState] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const productQuery = useRef('');
  const productPage = useRef(0);
  const productRequest = useRef(0);
  const productLoading = useRef(false);

  const setSearch = useCallback((value: string) => setSearchState(value), []);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const loadProducts = useCallback(async (searchValue = '', append = false, force = false) => {
    const query = searchValue.trim();
    if (append && (productLoading.current || query !== productQuery.current || !productsHasMore)) return;
    if (!append && !force && query === productQuery.current && (productPage.current > 0 || productLoading.current)) return;

    const pageSize = 100;
    const page = append ? productPage.current + 1 : 1;
    if (!append) {
      productQuery.current = query;
      productPage.current = 0;
      setProducts([]);
      setProductsHasMore(false);
    }

    const requestId = ++productRequest.current;
    productLoading.current = true;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) });
      if (query) params.set('q', query);
      const result = await callWebApi<{ products: Product[]; count: number }>(`/api/products?${params.toString()}`);
      if (requestId !== productRequest.current) return;
      const nextProducts = result.products || [];
      if (append) {
        setProducts((current) => {
          const existingIds = new Set(current.map((product) => product.id));
          return [...current, ...nextProducts.filter((product) => !existingIds.has(product.id))];
        });
      } else {
        setProducts(nextProducts);
      }
      productPage.current = page;
      setProductsHasMore(page * pageSize < Number(result.count || 0));
    } catch (loadError) {
      if (requestId === productRequest.current) {
        setProductsError(loadError instanceof Error ? loadError.message : 'Unable to load products.');
      }
    } finally {
      if (requestId === productRequest.current) {
        productLoading.current = false;
        setProductsLoading(false);
      }
    }
  }, [productsHasMore]);

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

        const [salesResult, settingsResult] = await Promise.all([
          salesQuery,
          supabase.from('business_settings').select('business_type').maybeSingle(),
        ]);
        if (salesResult.error) throw new Error(salesResult.error.message);
        if (settingsResult.error) throw new Error(settingsResult.error.message);
        if (mounted) {
          setSales((salesResult.data || []) as Sale[]);
          setBusinessType(settingsResult.data?.business_type || 'custom');
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

  return {
    role,
    businessType,
    sales,
    products,
    productsLoading,
    productsError,
    productsHasMore,
    loadProducts,
    loading: loading || authLoading || roleLoading,
    error,
    search,
    setSearch,
    date,
    setDate,
    refresh,
    createSale,
  };
}

export type { Product, Sale, SaleInput };
