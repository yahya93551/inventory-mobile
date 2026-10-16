import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth';
import { Button, Card, Input, KeyboardAwareScrollView } from '@/components/ui';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SignupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { configured, loading: authLoading, session, createAccount } = useAuth();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const submittingRef = useRef(false);

  if (authLoading) return null;
  if (session) return <Redirect href="/home" />;

  const validateAccountDetails = () => {
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || !confirmPassword) {
      setError('Enter your email, password, and password confirmation to continue.');
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateAccountDetails()) setStep(2);
  };

  const handleSignup = async () => {
    if (submittingRef.current) return;
    setError(null);
    setNotice(null);

    if (!validateAccountDetails()) return;
    if (!fullName.trim() || !businessName.trim()) {
      setError('Enter your full name and business name to continue.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await createAccount(normalizedEmail, password, fullName.trim(), businessName.trim());
      if (result.error) {
        setError(result.error);
      } else {
        setPassword('');
        setConfirmPassword('');
        router.replace({ pathname: '/login', params: { accountCreated: 'success' } });
      }
    } catch {
      setError('Unable to create your account. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
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
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>Set up your business account.</Text>
        </View>

        <Card style={styles.card}>
          <Text style={[styles.title, { color: theme.text }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {step === 1 ? 'Step 1 of 2 · Enter your sign-in details.' : 'Step 2 of 2 · Tell us about you and your business.'}
          </Text>

          {!configured && <Text style={[styles.message, { color: theme.warning }]}>Add the public Supabase environment variables to connect this app.</Text>}
          {error && <Text accessibilityRole="alert" style={[styles.message, { color: theme.danger }]}>{error}</Text>}
          {notice && <Text accessibilityRole="alert" style={[styles.message, { color: theme.success }]}>{notice}</Text>}

          {step === 1 ? (
            <>
              <Input
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                label="Email"
                placeholder="you@example.com"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.passwordField}>
                <Input
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect={false}
                  helperText="Use at least 6 characters."
                  label="Password"
                  placeholder="Create a password"
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityRole="button" onPress={() => setShowPassword((visible) => !visible)} style={styles.passwordToggle}>
                  <Text style={[styles.toggleText, { color: theme.primary }]}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              <Input
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                label="Confirm password"
                placeholder="Re-enter your password"
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onSubmitEditing={handleNext}
              />
              <Button label="Next" disabled={!configured} fullWidth onPress={handleNext} />
            </>
          ) : (
            <>
            <Input
              autoComplete="name"
              autoCapitalize="words"
              label="Full name"
              maxLength={200}
              placeholder="Your name"
              textContentType="name"
              value={fullName}
              onChangeText={setFullName}
            />
            <Input
              autoCapitalize="words"
              label="Business / company name"
              maxLength={200}
              placeholder="Your business name"
              value={businessName}
              onChangeText={setBusinessName}
              onSubmitEditing={handleSignup}
            />
            <Button label="Create account" loading={submitting} disabled={!configured} fullWidth onPress={handleSignup} />
            <Button label="Back" variant="secondary" disabled={submitting} fullWidth onPress={() => { setError(null); setStep(1); }} />
            </>
          )}
          <Link href="/login" asChild>
            <Pressable accessibilityRole="button" disabled={submitting} style={styles.loginButton}>
              <Text style={[styles.loginText, { color: theme.primary }]}>Back to sign in</Text>
            </Pressable>
          </Link>
        </Card>
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
  passwordToggle: { position: 'absolute', right: Spacing.three, bottom: 29, minHeight: 30, justifyContent: 'center' },
  toggleText: { ...Typography.label },
  loginButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  loginText: { ...Typography.label },
});
