import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { appStorage } from '@/lib/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.local',
  supabaseAnonKey || 'missing-public-anon-key',
  {
    auth: {
      storage: appStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);