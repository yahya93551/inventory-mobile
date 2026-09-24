import { useCallback, useEffect, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { supabase } from '@/lib/supabase';

type Product = {
  id: string;
  name: string;
  category: string | null;
  cost_price: number | null;
  price: number | null;
  stock: number | null;
  image_url?: string | null;
  custom_data?: Record<string, unknown> | null;
  base_unit?: string | null;
  converted_unit?: string | null;
  conversion_rate?: number | null;
  stock_remainder?: number | null;
};

type ProductInput = {
  name: string;
  category: string;
  cost_price?: number;
  price?: number;
  stock?: number;
  base_unit?: string | null;
  converted_unit?: string | null;
  conversion_rate?: number | null;
  stock_remainder?: number | null;
  custom_data?: Record<string, unknown>;
};

type StockFilter = 'all' | 'in' | 'low' | 'critical' | 'out';

export type InventoryState = {
  role: TenantRole | null;
  products: Product[];
  categories: string[];
  visibleFields: Set<string>;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  search: string;
  setSearch: (value: string) => void;
  stockFilter: StockFilter;
  setStockFilter: (value: StockFilter) => void;
  refresh: () => void;
  loadMore: () => void;
  addProduct: (input: ProductInput) => Promise<{ error: string | null; product: Product | null }>;
  updateProduct: (id: string, input: Partial<ProductInput>) => Promise<string | null>;
  deleteProduct: (id: string) => Promise<string | null>;
};

const pageSize = 50;
const fallbackVisibleFields = new Set(['name', 'category', 'cost_price', 'price', 'stock']);

function applySearch(query: any, search: string) {
  const value = search.trim();
  if (!value) return query;
  const numericSearch = Number(value);
  const filters = [`name.ilike.%${value}%`, `category.ilike.%${value}%`];
  if (!Number.isNaN(numericSearch)) filters.push(`price.eq.${numericSearch}`, `cost_price.eq.${numericSearch}`);
  return query.or(filters.join(','));
}

export function useInventory(): InventoryState {
  const { user, loading: authLoading } = useAuth();
  const { role, tenantId, loading: roleLoading } = useTenantRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(fallbackVisibleFields);
  const [search, setSearchState] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const setSearch = useCallback((value: string) => setSearchState(value), []);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (authLoading || roleLoading || !user) return;
    const timer = setTimeout(() => setPage(0), 300);
    return () => clearTimeout(timer);
  }, [authLoading, roleLoading, user, search, stockFilter]);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user) return () => { mounted = false; };

    const load = async () => {
      const isFirstPage = page === 0;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        let productQuery = supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        productQuery = applySearch(productQuery, search);

        const [productsResult, categoriesResult, fieldsResult] = await Promise.all([
          productQuery,
          supabase.from('categories').select('name').order('name', { ascending: true }),
          supabase.from('custom_fields').select('field_name,is_visible,is_system,field_order').eq('is_system', true).order('field_order', { ascending: true }),
        ]);

        if (productsResult.error) throw new Error(productsResult.error.message);
        if (categoriesResult.error) throw new Error(categoriesResult.error.message);
        if (fieldsResult.error) throw new Error(fieldsResult.error.message);

        const nextProducts = (productsResult.data || []) as Product[];
        if (!mounted) return;
        setProducts((current) => isFirstPage ? nextProducts : [...current, ...nextProducts]);
        setHasMore(nextProducts.length === pageSize);
        setCategories((categoriesResult.data || []).map((item) => item.name).filter(Boolean));
        setVisibleFields(fieldsResult.data?.length ? new Set(fieldsResult.data.filter((field) => field.is_visible).map((field) => field.field_name)) : fallbackVisibleFields);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load inventory.');
      } finally {
        if (mounted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    void load();
    return () => { mounted = false; };
  }, [attempt, authLoading, roleLoading, user, page, search]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) setPage((value) => value + 1);
  }, [hasMore, loading, loadingMore]);

  const addProduct = useCallback(async (input: ProductInput) => {
    if (!user?.id || !tenantId) return { error: 'Your tenant membership could not be verified.', product: null };
    const payload = {
      ...input,
      name: input.name.trim(),
      category: input.category.trim(),
      base_unit: input.base_unit?.trim() || null,
      converted_unit: input.converted_unit?.trim() || null,
      conversion_rate: input.conversion_rate ?? null,
      stock_remainder: input.stock_remainder ?? null,
      tenant_id: tenantId,
      user_id: user.id,
      created_by: user.id,
    };
    const { data, error: insertError } = await supabase.from('products').insert(payload).select('*').single();
    if (insertError) return { error: insertError.message, product: null };
    refresh();
    return { error: null, product: data as Product };
  }, [refresh, tenantId, user]);

  const updateProduct = useCallback(async (id: string, input: Partial<ProductInput>) => {
    const { error: updateError } = await supabase.from('products').update(input).eq('id', id);
    if (updateError) return updateError.message;
    refresh();
    return null;
  }, [refresh]);

  const deleteProduct = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('products').delete().eq('id', id);
    if (deleteError) return deleteError.message;
    refresh();
    return null;
  }, [refresh]);

  const filteredProducts = products.filter((product) => {
    const stock = Number(product.stock || 0);
    if (stockFilter === 'out') return stock === 0;
    if (stockFilter === 'critical') return stock > 0 && stock <= 5;
    if (stockFilter === 'low') return stock > 5 && stock < 20;
    if (stockFilter === 'in') return stock >= 20;
    return true;
  });

  return {
    role,
    products: filteredProducts,
    categories,
    visibleFields,
    loading: loading || authLoading || roleLoading,
    loadingMore,
    error,
    hasMore,
    search,
    setSearch,
    stockFilter,
    setStockFilter,
    refresh,
    loadMore,
    addProduct,
    updateProduct,
    deleteProduct,
  };
}

export type { Product, ProductInput, StockFilter };
