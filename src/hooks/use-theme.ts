/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type ThemeMode, type ThemeTokens } from '@/constants/theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

export function useTheme(): ThemeTokens {
  const { colorScheme: scheme } = useThemePreference();
  const theme: ThemeMode = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
