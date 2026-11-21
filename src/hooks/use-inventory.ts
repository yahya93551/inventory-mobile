import { useCallback, useEffect, useState } from 'react';
import { File as ExpoFile } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { supabase } from '@/lib/supabase';
import { callWebApi } from '@/lib/web-api';

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
  allocated_quantity?: number;
  allocation_availability?: {
    base_quantity: number;
    converted_quantity: number;
    converted_unit: string | null;
    conversion_rate: number | null;
  };
};

type ProductInput = {
  name: string;
  category: string;
  image_url?: string;
  cost_price?: number;
  price?: number;
  stock?: number;
  base_unit?: string | null;
  converted_unit?: string | null;
  conversion_rate?: number | null;
  stock_remainder?: number | null;
  custom_data?: Record<string, unknown>;
};

type ProductImage = { uri: string; width: number; height: number };
type ProductCustomField = {
  field_name: string;
  display_name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea' | 'currency';
  is_required: boolean;
  is_visible: boolean;
  select_options?: string[] | null;
  default_value?: string | null;
};
type StockFilter = 'all' | 'in' | 'low' | 'critical' | 'out';
type InventorySummary = { loaded: number; lowStock: number; outOfStock: number };

export type InventoryState = {
  role: TenantRole | null;
  products: Product[];
  summary: InventorySummary;
  categories: string[];
  customFields: ProductCustomField[];
  visibleFields: Set<string>;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  customFieldsError: string | null;
  hasMore: boolean;
  search: string;
  setSearch: (value: string) => void;
  stockFilter: StockFilter;
  setStockFilter: (value: StockFilter) => void;
  refresh: () => void;
  loadMore: () => void;
  addProduct: (input: ProductInput, image?: Pick<ProductImage, 'uri' | 'width' | 'height'>) => Promise<{ error: string | null; product: Product | null }>;
  updateProduct: (id: string, input: Partial<ProductInput>, image?: Pick<ProductImage, 'uri' | 'width' | 'height'>) => Promise<string | null>;
  deleteProduct: (id: string) => Promise<string | null>;
  restockProduct: (id: string, amount: number) => Promise<string | null>;
  takeStock: (id: string, quantity: number, reason?: string) => Promise<string | null>;
  dropTakenStock: (id: string, quantity: number) => Promise<string | null>;
};

const pageSize = 50;
const fallbackVisibleFields = new Set(['name', 'category', 'cost_price', 'price', 'stock']);

async function uploadProductImage(image: ProductImage) {
  const manipulator = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > 1024) {
    if (image.width >= image.height) manipulator.resize({ width: 1024 });
    else manipulator.resize({ height: 1024 });
  }
  const manipulatedImage = await manipulator.renderAsync();
  const compressedImage = await manipulatedImage.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const fileContents = await new ExpoFile(compressedImage.uri).arrayBuffer();
  const path = `products/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, fileContents, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Product image upload failed: ${error.message}`);

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  if (!data.publicUrl) {
    const { error: cleanupError } = await supabase.storage.from('product-images').remove([path]);
    if (cleanupError) {
      throw new Error(`Product image URL could not be created, and the uploaded image could not be cleaned up: ${cleanupError.message}`);
    }
    throw new Error('Product image upload succeeded, but its URL could not be created.');
  }

  return { path, url: data.publicUrl };
}

async function removeUploadedProductImage(path: string) {
  const { error } = await supabase.storage.from('product-images').remove([path]);
  return error?.message ?? null;
}

export function useInventory(): InventoryState {
  const { user, loading: authLoading } = useAuth();
  const { role, tenantId, loading: roleLoading } = useTenantRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<ProductCustomField[]>([]);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(fallbackVisibleFields);
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFieldsError, setCustomFieldsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const setSearch = useCallback((value: string) => setSearchState(value), []);
  const refresh = useCallback(() => {
    setPage(0);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (authLoading || roleLoading || !user) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [authLoading, roleLoading, user, search]);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user) return () => { mounted = false; };

    const load = async () => {
      const isFirstPage = page === 0;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page + 1),
          per_page: String(pageSize),
        });
        if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());

        const customFieldsRequest = page === 0
          ? callWebApi<ProductCustomField[]>('/api/custom-fields').catch((fieldsError: unknown) => {
            if (mounted) setCustomFieldsError(fieldsError instanceof Error ? fieldsError.message : 'Additional product fields could not be loaded.');
            return [];
          })
          : Promise.resolve(null);

        const [productsResult, categoriesResult, fieldsResult, customFieldsResult] = await Promise.all([
          callWebApi<{ products: Product[]; count: number }>(`/api/products?${params.toString()}`),
          page === 0 ? supabase.from('categories').select('name').order('name', { ascending: true }) : Promise.resolve(null),
          page === 0 ? supabase.from('custom_fields').select('field_name,is_visible,is_system,field_order').eq('is_system', true).order('field_order', { ascending: true }) : Promise.resolve(null),
          customFieldsRequest,
        ]);

        if (categoriesResult?.error) throw new Error(categoriesResult.error.message);
        if (fieldsResult?.error) throw new Error(fieldsResult.error.message);

        const nextProducts = productsResult.products || [];
        if (!mounted) return;
        setProducts((current) => isFirstPage ? nextProducts : [...current, ...nextProducts]);
        setHasMore(nextProducts.length === pageSize);
        if (categoriesResult) setCategories((categoriesResult.data || []).map((item) => item.name).filter(Boolean));
        if (fieldsResult) setVisibleFields(fieldsResult.data?.length ? new Set(fieldsResult.data.filter((field) => field.is_visible).map((field) => field.field_name)) : fallbackVisibleFields);
        if (customFieldsResult) {
          setCustomFields(customFieldsResult.filter((field) => field.is_visible));
          setCustomFieldsError(null);
        }
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
  }, [attempt, authLoading, roleLoading, user, page, debouncedSearch]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) setPage((value) => value + 1);
  }, [hasMore, loading, loadingMore]);

  const addProduct = useCallback(async (input: ProductInput, image?: ProductImage) => {
    if (!user?.id || !tenantId) return { error: 'Your tenant membership could not be verified.', product: null };
    const { stock_remainder, ...productFields } = input;
    const payload = {
      ...productFields,
      name: input.name.trim(),
      category: input.category.trim(),
      base_unit: input.base_unit?.trim() || null,
      converted_unit: input.converted_unit?.trim() || null,
      conversion_rate: input.conversion_rate ?? null,
      ...(typeof stock_remainder === 'number' ? { stock_remainder } : {}),
    };
    let uploadedImagePath: string | null = null;
    try {
      if (image) {
        const uploadedImage = await uploadProductImage(image);
        uploadedImagePath = uploadedImage.path;
        Object.assign(payload, { image_url: uploadedImage.url });
      }

      const product = await callWebApi<Product>('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      refresh();
      return { error: null, product };
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Unable to add product.';
      if (uploadedImagePath) {
        const cleanupError = await removeUploadedProductImage(uploadedImagePath);
        if (cleanupError) {
          return {
            error: `${message} The uploaded image could not be cleaned up: ${cleanupError}`,
            product: null,
          };
        }
      }
      return {
        error: message,
        product: null,
      };
    }
  }, [refresh, tenantId, user]);

  const updateProduct = useCallback(async (id: string, input: Partial<ProductInput>, image?: ProductImage) => {
    let uploadedImagePath: string | null = null;
    try {
      const updates = { ...input };
      if (image) {
        const uploadedImage = await uploadProductImage(image);
        uploadedImagePath = uploadedImage.path;
        updates.image_url = uploadedImage.url;
      }
      await callWebApi('/api/products', {
        method: 'PATCH',
        body: JSON.stringify({ id, updates }),
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update product.';
      if (uploadedImagePath) {
        const cleanupError = await removeUploadedProductImage(uploadedImagePath);
        if (cleanupError) return `${message} The uploaded image could not be cleaned up: ${cleanupError}`;
      }
      return message;
    }
    refresh();
    return null;
  }, [refresh]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      await callWebApi('/api/products', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
    } catch (deleteError) {
      return deleteError instanceof Error ? deleteError.message : 'Unable to delete product.';
    }
    refresh();
    return null;
  }, [refresh]);

  const restockProduct = useCallback(async (id: string, amount: number) => {
    try {
      await callWebApi('/api/products/restock', {
        method: 'POST',
        body: JSON.stringify({ id, amount }),
      });
      refresh();
      return null;
    } catch (restockError) {
      return restockError instanceof Error ? restockError.message : 'Unable to restock product.';
    }
  }, [refresh]);

  const takeStock = useCallback(async (id: string, quantity: number, reason?: string) => {
    try {
      await callWebApi('/api/products/load', {
        method: 'POST',
        body: JSON.stringify({ id, quantity, reason }),
      });
      refresh();
      return null;
    } catch (loadError) {
      return loadError instanceof Error ? loadError.message : 'Unable to take stock.';
    }
  }, [refresh]);

  const dropTakenStock = useCallback(async (id: string, quantity: number) => {
    try {
      await callWebApi('/api/products/drop', {
        method: 'POST',
        body: JSON.stringify({ id, quantity }),
      });
      refresh();
      return null;
    } catch (dropError) {
      return dropError instanceof Error ? dropError.message : 'Unable to return taken stock.';
    }
  }, [refresh]);

  const filteredProducts = products.filter((product) => {
    const stock = Number(product.stock || 0);
    if (stockFilter === 'out') return stock === 0;
    if (stockFilter === 'critical') return stock > 0 && stock <= 5;
    if (stockFilter === 'low') return stock > 5 && stock < 20;
    if (stockFilter === 'in') return stock >= 20;
    return true;
  });
  const summary: InventorySummary = {
    loaded: products.length,
    lowStock: products.filter((product) => Number(product.stock) > 0 && Number(product.stock) < 5).length,
    outOfStock: products.filter((product) => product.stock === 0).length,
  };

  return {
    role,
    products: filteredProducts,
    summary,
    categories,
    customFields,
    visibleFields,
    loading: loading || authLoading || roleLoading,
    loadingMore,
    error,
    customFieldsError,
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
    restockProduct,
    takeStock,
    dropTakenStock,
  };
}

export type { Product, ProductCustomField, ProductInput, StockFilter };
