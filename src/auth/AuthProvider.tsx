import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

async function restoreRecoverySession(url: string | null) {
  if (!url) return;

  const fragment = url.split('#')[1];
  if (!fragment) return;

  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return;

  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false);
        await SplashScreen.hideAsync();
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (mounted) {
        setSession(error ? null : data.session);
        setLoading(false);
      }
      await SplashScreen.hideAsync();
    };

    void restoreSession();

    void Linking.getInitialURL().then((url) => restoreRecoverySession(url));
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void restoreRecoverySession(url);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
    async signIn(email, password) {
      if (!isSupabaseConfigured) return { error: 'Supabase is not configured for this app.' };

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? getErrorMessage(error) : null };
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      return { error: error ? getErrorMessage(error) : null };
    },
    async sendPasswordReset(email) {
      if (!isSupabaseConfigured) return { error: 'Supabase is not configured for this app.' };

      const redirectTo = Linking.createURL('auth/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return { error: error ? getErrorMessage(error) : null };
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error ? getErrorMessage(error) : null };
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}