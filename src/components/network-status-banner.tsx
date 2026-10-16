import { StyleSheet, Text, View } from 'react-native';
import { useNetworkState } from 'expo-network';

import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function NetworkStatusBanner() {
  const theme = useTheme();
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;

  if (!offline) return null;

  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: theme.warningSurface, borderBottomColor: theme.warning }]}>
      <Text style={[styles.message, { color: theme.warningText }]}>No internet connection. Check your Wi-Fi or mobile data.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { minHeight: 40, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  message: { ...Typography.caption, fontWeight: '600', textAlign: 'center' },
});
