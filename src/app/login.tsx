import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth';
import { Button, Card, Input, KeyboardAwareScrollView } from '@/components/ui';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const { accountCreated } = useLocalSearchParams<{ accountCreated?: string }>();
  const { configured, loading: authLoading, session, mfaChallenge, signIn, verifyMfa, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (authLoading) return null;
  if (session) return <Redirect href="/home" />;

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setNotice(null);

    if (!normalizedEmail || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setSubmitting(true);
    if (mfaChallenge) {
      const verification = await verifyMfa(mfaCode);
      setSubmitting(false);
      if (verification.error) setError(verification.error);
      else setNotice('MFA verified. Signing you in.');
      return;
    }

    const result = await signIn(normalizedEmail, password);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else if (result.mfaRequired) setNotice('Enter your verification code.');
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setNotice(null);
    if (!normalizedEmail) {
      setError('Enter your email first, then request a password reset.');
      return;
    }

    setSubmitting(true);
    const result = await sendPasswordReset(normalizedEmail);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else setNotice('If an account exists for this email, a reset link has been sent.');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          <View style={styles.brandBlock}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.brandMark}
              accessibilityLabel="MyInventory logo"
            />
            <Text style={[styles.brand, { color: theme.text }]}>MyInventory</Text>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>Inventory and sales, clearly managed.</Text>
          </View>

          <Card style={styles.card}>
            <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in with your MyInventory account.</Text>

            {!configured && <Text style={[styles.message, { color: theme.warning }]}>Add the public Supabase environment variables to connect this app.</Text>}
            {error && <Text accessibilityRole="alert" style={[styles.message, { color: theme.danger }]}>{error}</Text>}
            {accountCreated === 'success' && <Text accessibilityRole="alert" style={[styles.message, { color: theme.success }]}>Your account was created successfully. Sign in to continue; if prompted, confirm your email first.</Text>}
            {notice && <Text style={[styles.message, { color: theme.success }]}>{notice}</Text>}

            <Input
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              label="Email"
              placeholder="you@example.com"
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            <View style={styles.passwordField}>
              <Input
                autoCapitalize="none"
                autoComplete="password"
                autoCorrect={false}
                label="Password"
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
              />
              <Pressable accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityRole="button" onPress={() => setShowPassword((visible) => !visible)} style={styles.passwordToggle}>
                <Text style={[styles.toggleText, { color: theme.primary }]}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            {mfaChallenge && (
              <Input
                autoCapitalize="none"
                autoComplete="one-time-code"
                keyboardType="number-pad"
                label={mfaChallenge.method === 'phone' ? 'SMS verification code' : 'Authenticator code'}
                placeholder="Six-digit code"
                value={mfaCode}
                onChangeText={setMfaCode}
              />
            )}

            <Button label={mfaChallenge ? 'Verify code' : 'Sign in'} loading={submitting} fullWidth onPress={handleLogin} />
            {!mfaChallenge && <Pressable accessibilityRole="button" disabled={submitting} onPress={handleForgotPassword} style={styles.forgotButton}>
              <Text style={[styles.forgotText, { color: theme.primary }]}>Forgot password?</Text>
            </Pressable>}
            {!mfaChallenge && <Link href="/signup" asChild>
              <Pressable accessibilityRole="button" disabled={submitting} style={styles.forgotButton}>
                <Text style={[styles.forgotText, { color: theme.primary }]}>Create account</Text>
              </Pressable>
            </Link>}
          </Card>

          <Text style={[styles.footer, { color: theme.textMuted }]}>Use the same account as the MyInventory web app.</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.four },
  brandBlock: { alignItems: 'center', gap: Spacing.one },
  brandMark: { width: 58, height: 58, borderRadius: Radius.lg, marginBottom: Spacing.two },
  brand: { fontSize: 28, fontWeight: '700' },
  tagline: { ...Typography.caption },
  card: { gap: Spacing.three },
  title: { ...Typography.sectionTitle },
  subtitle: { ...Typography.body },
  message: { ...Typography.caption },
  passwordField: { position: 'relative' },
  passwordToggle: { position: 'absolute', right: Spacing.three, bottom: 14, minHeight: 30, justifyContent: 'center' },
  toggleText: { ...Typography.label },
  forgotButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  forgotText: { ...Typography.label },
  footer: { ...Typography.caption, textAlign: 'center' },
});