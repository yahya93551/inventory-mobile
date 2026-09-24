import { Tabs, TabList, TabSlot, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTenantRole } from '@/auth';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RouteName = 'home' | 'inventory' | 'sales' | 'reports' | 'more';
type SymbolName = Exclude<SymbolViewProps['name'], string>;

const tabs: Array<{ name: RouteName; label: string; icon: SymbolName; managementOnly?: boolean }> = [
  { name: 'home', label: 'Home', icon: { ios: 'house', android: 'home', web: 'home' }, managementOnly: true },
  { name: 'inventory', label: 'Inventory', icon: { ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' } },
  { name: 'sales', label: 'Sales', icon: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' } },
  { name: 'reports', label: 'Reports', icon: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' }, managementOnly: true },
  { name: 'more', label: 'More', icon: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' } },
];

export default function AppTabs() {
  const { role } = useTenantRole();
  const visibleTabs = tabs.filter((tab) => !tab.managementOnly || role !== 'sales');

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <BottomTabList>
          {visibleTabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={`/${tab.name}`} asChild>
              <TabButton label={tab.label} icon={tab.icon} />
            </TabTrigger>
          ))}
        </BottomTabList>
      </TabList>
    </Tabs>
  );
}
function TabButton({ label, icon, isFocused, ...props }: TabTriggerSlotProps & { label: string; icon: SymbolName }) {
  const theme = useTheme();
  const tintColor = isFocused ? theme.primary : theme.textSecondary;

  return (
    <Pressable
      {...props}
      accessibilityLabel={`${label} tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <SymbolView tintColor={tintColor} name={icon} size={22} />
      <Text style={[styles.tabLabel, { color: tintColor }]}>{label}</Text>
    </Pressable>
  );
}

function BottomTabList(props: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[styles.tabList, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing.two) }]}
    />
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  tabList: {
    minHeight: 72,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.one,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  tabButton: {
    minHeight: 52,
    minWidth: 60,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  tabLabel: { ...Typography.caption, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
