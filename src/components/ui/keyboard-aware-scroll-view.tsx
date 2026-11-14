import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewInstance, type ScrollViewProps } from 'react-native';

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  children: ReactNode;
  scrollToEndOnKeyboardShow?: boolean;
};

export function KeyboardAwareScrollView({ children, scrollToEndOnKeyboardShow = false, ...props }: KeyboardAwareScrollViewProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (!scrollToEndOnKeyboardShow) return;

    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });

    return () => subscription.remove();
  }, [scrollToEndOnKeyboardShow]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" {...props}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
});