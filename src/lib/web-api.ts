import { supabase } from '@/lib/supabase';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';

export async function callWebApi<T>(path: string, options: RequestInit = {}) {
  if (!apiBaseUrl) throw new Error('The web API URL is not configured for sales actions.');
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.');

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok) throw new Error(body?.error || 'The request could not be completed.');
  return body?.data as T;
}
