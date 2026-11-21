import { supabase } from '@/lib/supabase';
import * as Network from 'expo-network';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';
const expiredSessionMessage = 'Your session has expired. Please sign in again.';
const requestTimeoutMs = 30_000;

async function clearExpiredSession() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) console.warn('[auth] Unable to clear expired local session:', error.message);
}

export async function callWebApi<T>(path: string, options: RequestInit = {}) {
  if (!apiBaseUrl) throw new Error('The MyInventory API URL is not configured. Update the app configuration and try again.');
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Unable to verify your sign-in session: ${sessionError.message}`);
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    await clearExpiredSession();
    throw new Error(expiredSessionMessage);
  }

  const controller = new AbortController();
  let timedOut = false;
  const callerSignal = options.signal;
  const handleCallerAbort = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', handleCallerAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, requestTimeoutMs);
  const cleanupRequest = () => {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', handleCallerAbort);
  };

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });
  } catch (requestError) {
    cleanupRequest();
    if (callerSignal?.aborted) {
      throw new Error('The request was cancelled.');
    }
    if (timedOut) {
      throw new Error('The MyInventory server took too long to respond. Check your connection and try again.');
    }
    const network = await Network.getNetworkStateAsync().catch(() => null);
    if (network?.isConnected === false || network?.isInternetReachable === false) {
      throw new Error('No internet connection. Check your Wi-Fi or mobile data and try again.');
    }
    const detail = requestError instanceof Error && requestError.message
      ? ` (${requestError.message})`
      : '';
    throw new Error(`Could not reach the MyInventory server. Check your connection or try again later.${detail}`);
  }

  try {
    if (response.status === 401) {
      await clearExpiredSession();
      throw new Error(expiredSessionMessage);
    }

    let body: {
      data?: T;
      error?: unknown;
      message?: unknown;
    };
    try {
      const text = await response.text();
      if (!text.trim()) throw new Error('Empty response body.');
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Unexpected response shape.');
      }
      body = parsed as typeof body;
    } catch {
      if (callerSignal?.aborted) throw new Error('The request was cancelled.');
      if (timedOut) {
        throw new Error('The MyInventory server took too long to respond. Check your connection and try again.');
      }
      if (!response.ok) {
        throw new Error(`The request could not be completed (HTTP ${response.status}). The server returned an unreadable error response.`);
      }
      throw new Error(`The MyInventory server returned an unreadable response (HTTP ${response.status}). Please try again.`);
    }
    if (!response.ok) {
      const errorMessage = typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : `The request could not be completed (HTTP ${response.status}).`;
      throw new Error(errorMessage);
    }
    if (!Object.prototype.hasOwnProperty.call(body, 'data')) {
      throw new Error('The MyInventory server response is missing its data. Please try again.');
    }
    return body.data as T;
  } finally {
    cleanupRequest();
  }
}
