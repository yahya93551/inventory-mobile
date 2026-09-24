import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
};

export function Input({ label, error, helperText, icon, style, ...props }: InputProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <View style={[styles.field, { backgroundColor: theme.input, borderColor: error ? theme.danger : theme.border }]}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text }, icon ? styles.inputWithIcon : undefined, style]}
          accessibilityLabel={label}
          {...props}
        />
      </View>
      {error ? <Text style={[styles.message, { color: theme.danger }]}>{error}</Text> : helperText ? <Text style={[styles.message, { color: theme.textSecondary }]}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', gap: Spacing.one },
  label: { ...Typography.label },
  field: { minHeight: 50, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 48, paddingHorizontal: Spacing.three, fontSize: 16, lineHeight: 22 },
  inputWithIcon: { paddingLeft: Spacing.one },
  icon: { paddingLeft: Spacing.three },
  message: { ...Typography.caption, paddingHorizontal: Spacing.one },
});