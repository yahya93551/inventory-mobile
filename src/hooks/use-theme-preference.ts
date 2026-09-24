import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform, useColorScheme as useSystemColorScheme, type ColorSchemeName } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
type ThemePreferenceContextValue = { preference: ThemePreference; setPreference: (value: ThemePreference) => void; colorScheme: Exclude<ColorSchemeName, null> };
const PreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);
const storageKey = 'myinventory-theme-preference';

async function readPreference() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(storageKey) as ThemePreference | null;
  return SecureStore.getItemAsync(storageKey) as Promise<ThemePreference | null>;
}
async function writePreference(value: ThemePreference) {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(storageKey, value);
  else await SecureStore.setItemAsync(storageKey, value);
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void readPreference().then((saved) => {
      if (saved === 'system' || saved === 'light' || saved === 'dark') setPreferenceState(saved);
    });
  }, []);

  const value = useMemo(() => ({
    preference,
    setPreference(valueToSet: ThemePreference) {
      setPreferenceState(valueToSet);
      void writePreference(valueToSet);
    },
    colorScheme: preference === 'system' ? systemScheme : preference,
  }), [preference, systemScheme]);

  return createElement(PreferenceContext.Provider, { value }, children);
}

export function useThemePreference() {
  const context = useContext(PreferenceContext);
  if (!context) throw new Error('useThemePreference must be used inside ThemePreferenceProvider');
  return context;
}
