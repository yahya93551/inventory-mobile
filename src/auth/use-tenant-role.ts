import { useEffect, useState } from 'react';

import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';

export type TenantRole = 'owner' | 'accountant' | 'sales';

type TenantRoleState = {
  role: TenantRole | null;
  tenantId: string | null;
  loading: boolean;
  error: string | null;
};

export function useTenantRole(): TenantRoleState {
  const { user } = useAuth();
  const [state, setState] = useState<TenantRoleState>({ role: null, tenantId: null, loading: true, error: null });

  useEffect(() => {
    let mounted = true;

    const loadRole = async () => {
      if (!user) {
        if (mounted) setState({ role: null, tenantId: null, loading: false, error: null });
        return;
      }

      const { data, error } = await supabase
        .from('tenant_members')
        .select('role, tenant_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        setState({ role: null, tenantId: null, loading: false, error: error.message });
        return;
      }

      const role = data?.role;
      setState({
        role: role === 'owner' || role === 'accountant' || role === 'sales' ? role : null,
        tenantId: data?.tenant_id ?? null,
        loading: false,
        error: null,
      });
    };

    void loadRole();
    return () => {
      mounted = false;
    };
  }, [user]);

  return state;
}