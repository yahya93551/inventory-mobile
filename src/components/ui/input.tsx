import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { ControlHeights, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
};

export function Input({ label, error, helperText, icon, style, onFocus, onBlur, editable = true, accessibilityLabel, accessibilityHint, accessibilityState, ...props }: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const disabled = !editable;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <View style={[styles.field, { backgroundColor: disabled ? theme.disabledSurface : theme.input, borderColor: error ? theme.danger : focused ? theme.focus : theme.border }, focused && styles.focused]}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: disabled ? theme.disabledText : theme.text }, icon ? styles.inputWithIcon : undefined, style]}
          accessibilityLabel={accessibilityLabel ?? label ?? props.placeholder}
          accessibilityHint={error ?? helperText ?? accessibilityHint}
          accessibilityState={{ ...accessibilityState, disabled }}
          editable={editable}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          {...props}
        />
      </View>
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.message, Typography.error, { color: theme.danger }]}>{error}</Text> : helperText ? <Text style={[styles.message, { color: theme.textSecondary }]}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', gap: Spacing.one },
  label: { ...Typography.label },
  field: { minHeight: ControlHeights.input, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center' },
  focused: { borderWidth: 2 },
  input: { flex: 1, minHeight: ControlHeights.input - 2, paddingHorizontal: Spacing.three, ...Typography.body },
  inputWithIcon: { paddingLeft: Spacing.one },
  icon: { paddingLeft: Spacing.three },
  message: { ...Typography.caption, paddingHorizontal: Spacing.one },
});