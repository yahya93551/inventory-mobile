/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export type ThemeTokens = {
  background: string;
  surface: string;
  card: string;
  input: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryStrong: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  backgroundElement: string;
  backgroundSelected: string;
};

export const Colors = {
  light: {
    background: '#f8fafc',
    surface: '#f1f5f9',
    card: '#ffffff',
    input: '#f8fafc',
    text: '#0f172a',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    border: '#cbd5e1',
    primary: '#06b6d4',
    primaryStrong: '#0891b2',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#d97706',
    danger: '#dc2626',
    backgroundElement: '#f1f5f9',
    backgroundSelected: '#e2e8f0',
  },
  dark: {
    background: '#0b1220',
    surface: '#0f172a',
    card: '#152033',
    input: '#101a2b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    border: '#334155',
    primary: '#06b6d4',
    primaryStrong: '#22d3ee',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    backgroundElement: '#0f172a',
    backgroundSelected: '#1e293b',
  },
} satisfies Record<ThemeMode, ThemeTokens>;

export type ThemeColor = keyof ThemeTokens;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

export const Typography = {
  screenTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const },
  sectionTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  metric: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
