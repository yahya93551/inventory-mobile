import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth, useTenantRole, type TenantRole } from '@/auth';
import { callWebApi } from '@/lib/web-api';

type Employee = { user_id: string; user_email: string; role: 'owner' | 'accountant' | 'sales'; active: boolean; created_at: string };
type EmployeeInput = { identifier: string; password: string; role: 'accountant' | 'sales' };
export type EmployeesState = { role: TenantRole | null; employees: Employee[]; filtered: Employee[]; query: string; setQuery: (value: string) => void; loading: boolean; error: string | null; refresh: () => void; addEmployee: (input: EmployeeInput) => Promise<string | null>; changeRole: (userId: string, role: 'accountant' | 'sales') => Promise<string | null>; removeEmployee: (userId: string) => Promise<string | null> };

export function useEmployees(): EmployeesState {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useTenantRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let mounted = true;
    if (authLoading || roleLoading || !user || role !== 'owner') return () => { mounted = false; };
    const load = async () => {
      setLoading(true); setError(null);
      try { const data = await callWebApi<Employee[]>('/api/subusers'); if (mounted) setEmployees(data || []); }
      catch (loadError) { if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load employees.'); }
      finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [attempt, authLoading, role, roleLoading, user]);

  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return value ? employees.filter((employee) => employee.user_email.toLowerCase().includes(value) || employee.role.includes(value)) : employees; }, [employees, query]);
  const addEmployee = useCallback(async (input: EmployeeInput) => { try { await callWebApi('/api/subusers', { method: 'POST', body: JSON.stringify(input) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to create employee.'; } }, [refresh]);
  const changeRole = useCallback(async (userId: string, nextRole: 'accountant' | 'sales') => { try { await callWebApi('/api/subusers', { method: 'PUT', body: JSON.stringify({ user_id: userId, new_role: nextRole }) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to change role.'; } }, [refresh]);
  const removeEmployee = useCallback(async (userId: string) => { try { await callWebApi('/api/subusers', { method: 'DELETE', body: JSON.stringify({ user_id: userId }) }); refresh(); return null; } catch (err) { return err instanceof Error ? err.message : 'Unable to remove employee.'; } }, [refresh]);
  return { role, employees, filtered, query, setQuery, loading: loading || authLoading || roleLoading, error, refresh, addEmployee, changeRole, removeEmployee };
}

export type { Employee, EmployeeInput };
