import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SupportedStorage } from '@supabase/supabase-js';

const nativeStorage: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const appStorage: SupportedStorage = Platform.OS === 'web'
  ? {
      getItem: async (key) => globalThis.localStorage?.getItem(key) ?? null,
      setItem: async (key, value) => globalThis.localStorage?.setItem(key, value),
      removeItem: async (key) => globalThis.localStorage?.removeItem(key),
    }
  : nativeStorage;
