import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { callWebApi } from '@/lib/web-api';

type CategoryState = { role: TenantRole | null; categories: string[]; filtered: string[]; query: string; setQuery: (value: string) => void; loading: boolean; error: string | null; refresh: () => void; addCategory: (name: string) => Promise<string | null>; updateCategory: (oldName: string, newName: string) => Promise<string | null>; deleteCategory: (name: string) => Promise<string | null> };

export function useCategories(): CategoryState {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useTenantRole();
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user || role === 'sales') return () => { mounted = false; };
    const load = async () => {
      setLoading(true); setError(null);
      try { const data = await callWebApi<string[]>('/api/categories'); if (mounted) setCategories(data || []); }
      catch (loadError) { if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load categories.'); }
      finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [attempt, authLoading, role, roleLoading, user]);

  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return value ? categories.filter((category) => category.toLowerCase().includes(value)) : categories; }, [categories, query]);
  const addCategory = useCallback(async (name: string) => { try { await callWebApi('/api/categories', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to add category.'; } }, [refresh]);
  const updateCategory = useCallback(async (oldName: string, newName: string) => { try { await callWebApi('/api/categories', { method: 'PATCH', body: JSON.stringify({ oldName, newName: newName.trim() }) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to update category.'; } }, [refresh]);
  const deleteCategory = useCallback(async (name: string) => { try { await callWebApi('/api/categories', { method: 'DELETE', body: JSON.stringify({ name }) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to delete category.'; } }, [refresh]);
  return { role, categories, filtered, query, setQuery, loading: loading || authLoading || roleLoading, error, refresh, addCategory, updateCategory, deleteCategory };
}
