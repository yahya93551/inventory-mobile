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
  primaryText: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  primarySurface: string;
  secondarySurface: string;
  success: string;
  successText: string;
  successForeground: string;
  successSurface: string;
  warning: string;
  warningText: string;
  warningForeground: string;
  warningSurface: string;
  danger: string;
  dangerText: string;
  dangerForeground: string;
  dangerAction: string;
  onDanger: string;
  dangerSurface: string;
  focus: string;
  disabledSurface: string;
  disabledText: string;
  shadow: string;
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
    primaryText: '#083344',
    primaryForeground: '#0e7490',
    secondary: '#8b5cf6',
    secondaryForeground: '#6d28d9',
    primarySurface: '#cffafe',
    secondarySurface: '#ede9fe',
    success: '#10b981',
    successText: '#022c22',
    successForeground: '#065f46',
    successSurface: '#d1fae5',
    warning: '#d97706',
    warningText: '#451a03',
    warningForeground: '#92400e',
    warningSurface: '#fef3c7',
    danger: '#dc2626',
    dangerText: '#450a0a',
    dangerForeground: '#b91c1c',
    dangerAction: '#b91c1c',
    onDanger: '#ffffff',
    dangerSurface: '#fee2e2',
    focus: '#0891b2',
    disabledSurface: '#e2e8f0',
    disabledText: '#64748b',
    shadow: '#0f172a',
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
    primaryText: '#083344',
    primaryForeground: '#a5f3fc',
    secondary: '#8b5cf6',
    secondaryForeground: '#ddd6fe',
    primarySurface: '#164e63',
    secondarySurface: '#3b0764',
    success: '#10b981',
    successText: '#052e2b',
    successForeground: '#a7f3d0',
    successSurface: '#064e3b',
    warning: '#f59e0b',
    warningText: '#422006',
    warningForeground: '#fde68a',
    warningSurface: '#713f12',
    danger: '#ef4444',
    dangerText: '#450a0a',
    dangerForeground: '#fecaca',
    dangerAction: '#b91c1c',
    onDanger: '#ffffff',
    dangerSurface: '#7f1d1d',
    focus: '#22d3ee',
    disabledSurface: '#1e293b',
    disabledText: '#94a3b8',
    shadow: '#000000',
    backgroundElement: '#0f172a',
    backgroundSelected: '#1e293b',
  },
} satisfies Record<ThemeMode, ThemeTokens>;

export type ThemeColor = keyof ThemeTokens;

export const Layout = {
  pagePadding: 24,
  contentTop: 24,
  headerMinHeight: 76,
  headerActionSize: 48,
  maxContentWidth: 800,
} as const;

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
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const ControlHeights = {
  compact: 44,
  standard: 48,
  large: 52,
  input: 48,
} as const;

export const Elevation = {
  card: 1,
  floating: 4,
} as const;

export const Shadows = {
  card: { shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: Elevation.card },
  floating: { shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: Elevation.floating },
} as const;

export const Typography = {
  screenTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  helper: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  error: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  metric: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  button: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = Layout.maxContentWidth;
