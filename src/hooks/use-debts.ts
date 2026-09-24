import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { callWebApi } from '@/lib/web-api';

type Debt = { id: string; customer_name: string; customer_phone: string; amount: number; note?: string | null; date: string; paid: boolean; created_at: string };
type DebtInput = { customer_name: string; customer_phone: string; amount: number; date: string; note?: string };
type DebtFilter = 'all' | 'unpaid';
type SortBy = 'latest' | 'high-balance';

type Customer = { name: string; phone: string; debts: Debt[]; total: number; outstanding: number; latestDate: string };
export type DebtsState = { role: TenantRole | null; debts: Debt[]; customers: Customer[]; loading: boolean; error: string | null; query: string; setQuery: (value: string) => void; filter: DebtFilter; setFilter: (value: DebtFilter) => void; sortBy: SortBy; setSortBy: (value: SortBy) => void; refresh: () => void; addDebt: (input: DebtInput) => Promise<string | null>; markPaid: (id: string) => Promise<string | null>; deleteDebt: (id: string) => Promise<string | null> };

export function useDebts(): DebtsState {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useTenantRole();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DebtFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('latest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user) return () => { mounted = false; };
    if (role !== 'owner') return () => { mounted = false; };
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const records = await callWebApi<Debt[]>('/api/debts');
        if (mounted) setDebts(records || []);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load debts.');
      } finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [attempt, authLoading, role, roleLoading, user]);

  const customers = useMemo(() => {
    const grouped = new Map<string, { name: string; phone: string; debts: Debt[] }>();
    for (const debt of debts) {
      const current = grouped.get(debt.customer_phone);
      grouped.set(debt.customer_phone, { name: debt.customer_name || current?.name || '', phone: debt.customer_phone, debts: [...(current?.debts || []), debt] });
    }
    let result = [...grouped.values()].map((customer) => ({ ...customer, total: customer.debts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0), outstanding: customer.debts.reduce((sum, debt) => sum + (debt.paid ? 0 : Number(debt.amount || 0)), 0), latestDate: customer.debts[0]?.date || '' }));
    const normalized = query.trim().toLowerCase();
    if (normalized) result = result.filter((customer) => customer.name.toLowerCase().includes(normalized) || customer.phone.toLowerCase().includes(normalized) || customer.debts.some((debt) => String(debt.amount).includes(normalized) || debt.date.toLowerCase().includes(normalized) || (debt.note || '').toLowerCase().includes(normalized)));
    if (filter === 'unpaid') result = result.filter((customer) => customer.debts.some((debt) => !debt.paid));
    result.sort((a, b) => { const aUnpaid = a.debts.some((debt) => !debt.paid); const bUnpaid = b.debts.some((debt) => !debt.paid); if (aUnpaid !== bUnpaid) return aUnpaid ? -1 : 1; return sortBy === 'high-balance' ? b.outstanding - a.outstanding : b.latestDate.localeCompare(a.latestDate); });
    return result;
  }, [debts, filter, query, sortBy]);

  const addDebt = useCallback(async (input: DebtInput) => { try { await callWebApi('/api/debts', { method: 'POST', body: JSON.stringify(input) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to add debt.'; } }, [refresh]);
  const markPaid = useCallback(async (id: string) => { try { await callWebApi('/api/debts', { method: 'PATCH', body: JSON.stringify({ id, paid: true }) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to mark debt paid.'; } }, [refresh]);
  const deleteDebt = useCallback(async (id: string) => { try { await callWebApi('/api/debts', { method: 'DELETE', body: JSON.stringify({ id }) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to delete debt.'; } }, [refresh]);

  return { role, debts, customers, loading: loading || authLoading || roleLoading, error, query, setQuery, filter, setFilter, sortBy, setSortBy, refresh, addDebt, markPaid, deleteDebt };
}

export type { Customer, Debt, DebtFilter, DebtInput, SortBy };
