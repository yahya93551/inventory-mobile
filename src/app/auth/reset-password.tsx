import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth';
import { Button, Card, Input } from '@/components/ui';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { session, updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!session) {
      setError('This reset link is no longer active. Request a new one from the login screen.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else setSuccess(true);
  };

  if (success) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          <Card style={styles.card}>
            <Text style={[styles.title, { color: theme.text }]}>Password updated</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Your MyInventory password has been changed.</Text>
            <Button label="Return to login" fullWidth onPress={() => { void signOut(); router.replace('/login'); }} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <View style={[styles.brandMark, { backgroundColor: theme.primary }]}><Text style={styles.brandMarkText}>M</Text></View>
            <Text style={[styles.brand, { color: theme.text }]}>MyInventory</Text>
          </View>
          <Card style={styles.card}>
            <Text style={[styles.title, { color: theme.text }]}>Create a new password</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Choose a new password for your account.</Text>
            {error && <Text accessibilityRole="alert" style={[styles.message, { color: theme.danger }]}>{error}</Text>}
            <View style={styles.passwordField}>
              <Input label="New password" placeholder="At least 6 characters" secureTextEntry={!showPassword} textContentType="newPassword" value={password} onChangeText={setPassword} />
              <Pressable accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityRole="button" onPress={() => setShowPassword((visible) => !visible)} style={styles.passwordToggle}>
                <Text style={[styles.toggleText, { color: theme.primary }]}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            <Input label="Confirm password" placeholder="Enter the password again" secureTextEntry={!showPassword} textContentType="newPassword" value={confirmation} onChangeText={setConfirmation} onSubmitEditing={handleSubmit} />
            <Button label="Update password" loading={submitting} fullWidth onPress={handleSubmit} />
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.four },
  brandBlock: { alignItems: 'center' },
  brandMark: { width: 54, height: 54, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  brandMarkText: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  brand: { fontSize: 26, fontWeight: '700' },
  card: { gap: Spacing.three },
  title: { ...Typography.sectionTitle },
  subtitle: { ...Typography.body },
  message: { ...Typography.caption },
  passwordField: { position: 'relative' },
  passwordToggle: { position: 'absolute', right: Spacing.three, bottom: 14, minHeight: 30, justifyContent: 'center' },
  toggleText: { ...Typography.label },
});