import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';

export default function SignupScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; username?: string; general?: string }>({});

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    return newErrors;
  };

  const handleSignup = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setErrors({ general: signUpError.message });
        return;
      }

      if (!data.user) {
        setErrors({ general: 'Signup failed. Please try again.' });
        return;
      }

      // Insert user profile row
      const { error: insertError } = await supabase
        .from('users' as any)
        .insert({
          id: data.user.id,
          username: username.trim(),
          display_name: username.trim(),
        });

      // If insert fails (e.g. table name differs), we still navigate — don't block signup
      if (insertError) {
        console.warn('User row insert failed:', insertError.message);
      }

      router.push('/(auth)/onboarding');
    } catch (err: any) {
      setErrors({ general: err?.message ?? 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Background glows */}
          <View style={styles.bgGlow1} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.wordmark}>PROTOCOL</Text>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start your first challenge today.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* General error */}
            {errors.general ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[
                  styles.input,
                  usernameFocused && styles.inputFocused,
                  errors.username ? styles.inputError : null,
                ]}
                placeholder="e.g. beast_mode_99"
                placeholderTextColor={theme.colors.textMuted}
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  if (errors.username) setErrors((e) => ({ ...e, username: undefined }));
                }}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
              />
              {errors.username ? (
                <Text style={styles.fieldError}>{errors.username}</Text>
              ) : null}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  emailFocused && styles.inputFocused,
                  errors.email ? styles.inputError : null,
                ]}
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.textMuted}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
              {errors.email ? (
                <Text style={styles.fieldError}>{errors.email}</Text>
              ) : null}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  passwordFocused && styles.inputFocused,
                  errors.password ? styles.inputError : null,
                ]}
                placeholder="Min. 8 characters"
                placeholderTextColor={theme.colors.textMuted}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              {errors.password ? (
                <Text style={styles.fieldError}>{errors.password}</Text>
              ) : null}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign in link */}
          <TouchableOpacity
            style={styles.signinLink}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.signinLinkText}>
              Already have an account?{' '}
              <Text style={styles.signinLinkAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  bgGlow1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.colors.accent,
    opacity: 0.06,
    transform: [{ scale: 1.3 }],
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    gap: theme.spacing.sm,
  },
  wordmark: {
    fontFamily: 'JetBrainsMono',
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.accent,
    letterSpacing: 6,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontFamily: 'Inter',
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xxl,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 71, 87, 0.12)',
    borderWidth: 1,
    borderColor: '#FF4757',
    borderRadius: 8,
    padding: theme.spacing.md,
  },
  errorBannerText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#FF4757',
    textAlign: 'center',
  },
  fieldGroup: {
    gap: theme.spacing.xs,
  },
  label: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#FFFFFF',
    height: 52,
  },
  inputFocused: {
    borderColor: theme.colors.accent,
  },
  inputError: {
    borderColor: '#FF4757',
  },
  fieldError: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: '#FF4757',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.accent,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  signinLink: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: theme.spacing.lg,
  },
  signinLinkText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  signinLinkAccent: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
});
