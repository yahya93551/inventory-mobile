import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AuthProvider, TenantRoleProvider } from '@/auth';
import { NetworkStatusBanner } from '@/components/network-status-banner';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <ThemePreferenceProvider>
      <ThemedApp />
    </ThemePreferenceProvider>
  );
}

function ThemedApp() {
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <TenantRoleProvider>
          <View style={styles.app}>
            <NetworkStatusBanner />
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </TenantRoleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ app: { flex: 1 } });
