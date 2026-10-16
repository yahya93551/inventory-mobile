import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { appStorage } from '@/lib/storage';
import { callWebApi } from '@/lib/web-api';

type MFAChallenge = { factorId: string; challengeId: string; method: 'totp' | 'phone'; expiresAt: number };
type AuthResult = { error: string | null; mfaRequired?: boolean };
type SessionCheckResult = { status: 'ready' | 'challenge' | 'error'; error?: string };
type PendingBusinessSetup = { email: string; fullName: string; businessName: string };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  mfaChallenge: MFAChallenge | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  createAccount: (email: string, password: string, fullName: string, businessName: string) => Promise<AuthResult>;
  verifyMfa: (code: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const pendingBusinessSetupKey = 'myinventory.pending-business-setup';

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

async function completePendingBusinessSetup(session: Session) {
  const stored = await appStorage.getItem(pendingBusinessSetupKey);
  if (!stored) return;

  const parsed: unknown = JSON.parse(stored);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Saved business setup details are invalid. Please contact support.');
  }
  const details = parsed as Record<string, unknown>;
  if (typeof details.email !== 'string' || typeof details.fullName !== 'string' || typeof details.businessName !== 'string') {
    throw new Error('Saved business setup details are incomplete. Please contact support.');
  }
  if (details.email.toLowerCase() !== session.user.email?.toLowerCase()) return;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!apiUrl) throw new Error('Business setup service is not configured.');

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/business-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        business_type: 'custom',
        business_name: details.businessName,
        business_contact_name: details.fullName,
      }),
    });
  } catch {
    throw new Error('Could not reach the business setup service. Please try signing in again.');
  }

  const result = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(result?.error || 'Unable to complete business setup. Please try signing in again.');
  await appStorage.removeItem(pendingBusinessSetupKey);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const assuranceChecks = useRef(new Map<string, Promise<SessionCheckResult>>());

  const checkSessionAssurance = async (nextSession: Session | null) => {
    if (!nextSession) {
      setSession(null);
      setMfaChallenge(null);
      return { status: 'ready' } as const;
    }

    const existingCheck = assuranceChecks.current.get(nextSession.access_token);
    if (existingCheck) return existingCheck;

    const check = (async (): Promise<SessionCheckResult> => {
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(nextSession.access_token);
      if (assuranceError) {
        setSession(null);
        return { status: 'error' };
      }

      if (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          setSession(null);
          return { status: 'error' };
        }
        const totpFactor = factors?.totp[0];
        const phoneFactor = factors?.phone[0];
        const method: 'totp' | 'phone' = !totpFactor && phoneFactor ? 'phone' : 'totp';
        const factor = method === 'phone' ? phoneFactor : totpFactor;
        if (!factor) {
          setSession(null);
          return { status: 'error' };
        }
        const challenge = await supabase.auth.mfa.challenge(
          method === 'phone' ? { factorId: factor.id, channel: 'sms' } : { factorId: factor.id }
        );
        if (challenge.error) {
          setSession(null);
          return { status: 'error' };
        }
        setSession(null);
        setMfaChallenge({ factorId: factor.id, challengeId: challenge.data.id, method, expiresAt: challenge.data.expires_at });
        return { status: 'challenge' };
      }

      try {
        await completePendingBusinessSetup(nextSession);
      } catch (error) {
        setSession(null);
        return { status: 'error', error: getErrorMessage(error) };
      }

      setMfaChallenge(null);
      setSession(nextSession);
      return { status: 'ready' };
    })();
    assuranceChecks.current.set(nextSession.access_token, check);
    return check;
  };

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false);
        await SplashScreen.hideAsync();
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (mounted && !error) await checkSessionAssurance(data.session);
      if (mounted) setLoading(false);
      await SplashScreen.hideAsync();
    };

    void restoreSession();

    void Linking.getInitialURL().then((url) => restoreRecoverySession(url));
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void restoreRecoverySession(url);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) void checkSessionAssurance(nextSession);
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
    mfaChallenge,
    async signIn(email, password) {
      if (!isSupabaseConfigured) return { error: 'Supabase is not configured for this app.' };

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: getErrorMessage(error) };
      const result = await checkSessionAssurance(data.session);
      if (result.status === 'error') return { error: result.error || 'Unable to verify your sign-in session. Please try again.' };
      return { error: null, mfaRequired: result.status === 'challenge' };
    },
    async createAccount(email, password, fullName, businessName) {
      if (!isSupabaseConfigured) return { error: 'Supabase is not configured for this app.' };

      const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
      if (!apiUrl) return { error: 'Account creation service is not configured.' };

      let response: Response;
      try {
        response = await fetch(`${apiUrl}/api/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
      } catch {
        return { error: 'Could not reach the account creation service. Check your connection and try again.' };
      }

      const signupResult = await response.json().catch(() => null) as { error?: string; success?: boolean } | null;
      if (!response.ok || !signupResult?.success) {
        return { error: signupResult?.error || 'Unable to create your account. Please try again.' };
      }

      const pendingDetails: PendingBusinessSetup = {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        businessName: businessName.trim(),
      };
      try {
        await appStorage.setItem(pendingBusinessSetupKey, JSON.stringify(pendingDetails));
      } catch {
        return { error: 'Your account was created, but business setup details could not be saved securely on this device. Sign in and complete Business settings to finish setup.' };
      }

      return { error: null };
    },
    async verifyMfa(code) {
      if (!mfaChallenge) return { error: 'No MFA challenge is pending.' };
      if (!/^\d{6}$/.test(code.trim())) return { error: 'Enter the six-digit verification code.' };

      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;
      if (!currentSession) return { error: 'Your sign-in session expired. Please sign in again.' };

      try {
        let challengeId = mfaChallenge.challengeId;
        if (Date.now() >= mfaChallenge.expiresAt * 1000) {
          const refreshed = await supabase.auth.mfa.challenge(
            mfaChallenge.method === 'phone'
              ? { factorId: mfaChallenge.factorId, channel: 'sms' }
              : { factorId: mfaChallenge.factorId }
          );
          if (refreshed.error) return { error: getErrorMessage(refreshed.error) };
          challengeId = refreshed.data.id;
          setMfaChallenge({ ...mfaChallenge, challengeId, expiresAt: refreshed.data.expires_at });
          return { error: 'A new verification challenge was sent. Enter the new code.' };
        }

        const tokens = await callWebApi<{ access_token: string; refresh_token: string }>('/api/auth/mfa/verify', {
          method: 'POST',
          body: JSON.stringify({
            factor_id: mfaChallenge.factorId,
            challenge_id: challengeId,
            method: mfaChallenge.method,
            code: code.trim(),
            refresh_token: currentSession.refresh_token,
          }),
        });
        const { error: setSessionError } = await supabase.auth.setSession(tokens);
        if (setSessionError) return { error: getErrorMessage(setSessionError) };
        setMfaChallenge(null);
        return { error: null };
      } catch (error) {
        return { error: getErrorMessage(error) };
      }
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      setMfaChallenge(null);
      return { error: error ? getErrorMessage(error) : null };
    },
    async sendPasswordReset(email) {
      if (!isSupabaseConfigured) return { error: 'Supabase is not configured for this app.' };

      const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
      if (!apiUrl) return { error: 'Password recovery service is not configured.' };
      try {
        const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), platform: 'mobile' }),
        });
        if (!response.ok) return { error: 'Unable to request a reset link. Please try again later.' };
        return { error: null };
      } catch {
        return { error: 'Unable to reach the password recovery service.' };
      }
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error ? getErrorMessage(error) : null };
    },
  }), [loading, mfaChallenge, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}