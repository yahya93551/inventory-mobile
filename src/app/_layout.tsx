import { useRef } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, TenantRoleProvider, useAuth } from '@/auth';
import { NetworkStatusBanner } from '@/components/network-status-banner';
import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';
import { Colors, Spacing, Typography } from '@/constants/theme';

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
          <AppContent backgroundColor={colors.background} textSecondary={colors.textSecondary} primary={colors.primary} />
        </TenantRoleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppContent({ backgroundColor, textSecondary, primary }: { backgroundColor: string; textSecondary: string; primary: string }) {
  const { loading } = useAuth();
  const didHideSplash = useRef(false);

  const handleLayout = () => {
    if (didHideSplash.current) return;
    didHideSplash.current = true;
    void SplashScreen.hideAsync();
  };

  return (
    <View onLayout={handleLayout} style={[styles.app, { backgroundColor }]}>
      {loading ? (
        <View style={styles.startup}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} accessibilityLabel="MyInventory logo" />
          <ActivityIndicator color={primary} size="small" />
          <Text style={[styles.startupLabel, { color: textSecondary }]}>Getting things ready...</Text>
        </View>
      ) : (
        <>
          <NetworkStatusBanner />
          <Stack screenOptions={{ headerShown: false }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  startup: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  logo: { width: 64, height: 64, borderRadius: 16, marginBottom: Spacing.two },
  startupLabel: { ...Typography.body },
});
