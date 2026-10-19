import { supabase } from '@/lib/supabase';
import * as Network from 'expo-network';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';
const expiredSessionMessage = 'Your session has expired. Please sign in again.';

async function clearExpiredSession() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) console.warn('[auth] Unable to clear expired local session:', error.message);
}

export async function callWebApi<T>(path: string, options: RequestInit = {}) {
  if (!apiBaseUrl) throw new Error('The web API URL is not configured for sales actions.');
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    await clearExpiredSession();
    throw new Error(expiredSessionMessage);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });
  } catch {
    const network = await Network.getNetworkStateAsync().catch(() => null);
    if (network?.isConnected === false || network?.isInternetReachable === false) {
      throw new Error('No internet connection. Check your Wi-Fi or mobile data and try again.');
    }
    throw new Error('Could not reach the MyInventory server. Check your connection or try again later.');
  }
  const body = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (response.status === 401) {
    await clearExpiredSession();
    throw new Error(expiredSessionMessage);
  }
  if (!response.ok) throw new Error(body?.error || 'The request could not be completed.');
  return body?.data as T;
}
