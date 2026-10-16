import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  children: React.ReactNode;
};

export function KeyboardAwareScrollView({ children, ...props }: KeyboardAwareScrollViewProps) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
      <ScrollView keyboardShouldPersistTaps="handled" {...props}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
});