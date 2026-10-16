import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from './AuthProvider';
import { callWebApi } from '@/lib/web-api';

export type TenantRole = 'owner' | 'accountant' | 'sales';

type TenantRoleState = {
  role: TenantRole | null;
  tenantId: string | null;
  loading: boolean;
  error: string | null;
};

type CachedTenantRoleState = TenantRoleState & { userId: string | null };

const TenantRoleContext = createContext<TenantRoleState | null>(null);

export function TenantRoleProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<CachedTenantRoleState>({ userId: null, role: null, tenantId: null, loading: true, error: null });

  useEffect(() => {
    let mounted = true;
    const userId = user?.id ?? null;

    if (authLoading) return () => { mounted = false; };

    const loadRole = async () => {
      if (!userId) {
        if (mounted) setState({ userId: null, role: null, tenantId: null, loading: false, error: null });
        return;
      }

      setState({ userId, role: null, tenantId: null, loading: true, error: null });
      try {
        const data = await callWebApi<{ role: string; tenant_id: string }>('/api/tenant-role');
        if (!mounted) return;
        const role = data.role;
        setState({
          userId,
          role: role === 'owner' || role === 'accountant' || role === 'sales' ? role : null,
          tenantId: data.tenant_id,
          loading: false,
          error: null,
        });
      } catch (loadError) {
        if (!mounted) return;
        setState({ userId, role: null, tenantId: null, loading: false, error: loadError instanceof Error ? loadError.message : 'Unable to verify tenant membership.' });
      }
    };

    void loadRole();
    return () => {
      mounted = false;
    };
  }, [authLoading, user?.id]);

  const currentUserId = user?.id ?? null;
  const currentState = state.userId === currentUserId && !authLoading
    ? state
    : { role: null, tenantId: null, loading: authLoading || Boolean(currentUserId), error: null };

  return createElement(TenantRoleContext.Provider, { value: currentState }, children);
}

export function useTenantRole(): TenantRoleState {
  const state = useContext(TenantRoleContext);
  if (!state) throw new Error('useTenantRole must be used inside TenantRoleProvider');
  return state;
}