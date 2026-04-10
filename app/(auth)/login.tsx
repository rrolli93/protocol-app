import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { theme } from '../../constants/theme';

const STRAVA_ORANGE = '#FC4C02';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithOAuth, loading: authLoading } = useAuth();
  const { connect: connectWallet, isConnecting } = useWallet();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleCoinbaseWallet = async () => {
    setActiveAction('coinbase');
    try {
      await connectWallet();
      // Auth state listener in useAuth will handle navigation
    } catch {
      // error handled in hook
    } finally {
      setActiveAction(null);
    }
  };

  const handleApple = async () => {
    setActiveAction('apple');
    try {
      await signInWithOAuth('apple');
    } finally {
      setActiveAction(null);
    }
  };

  const handleStrava = async () => {
    setActiveAction('strava');
    try {
      // Strava OAuth handled via expo-auth-session
      await Linking.openURL('protocol://auth/strava');
    } catch {
      // fallback — open strava web auth
      await Linking.openURL('https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=protocol://auth/strava&approval_prompt=auto&scope=read,activity:read_all');
    } finally {
      setActiveAction(null);
    }
  };

  const handleTerms = () => {
    Linking.openURL('https://protocol.app/terms');
  };

  const handlePrivacy = () => {
    Linking.openURL('https://protocol.app/privacy');
  };

  const isLoading = authLoading || isConnecting;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.container}>
        {/* Background decorative elements */}
        <View style={styles.bgGlow1} />
        <View style={styles.bgGlow2} />

        {/* Logo section */}
        <View style={styles.logoSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>⚡</Text>
          </View>
          <Text style={styles.wordmark}>PROTOCOL</Text>
          <Text style={styles.tagline}>Run your protocol. Win their stack.</Text>
        </View>

        {/* Auth buttons */}
        <View style={styles.buttonSection}>
          {/* Coinbase Wallet — primary CTA */}
          <TouchableOpacity
            onPress={handleCoinbaseWallet}
            disabled={isLoading}
            activeOpacity={0.8}
            style={[styles.button, styles.buttonPrimary]}
          >
            {activeAction === 'coinbase' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.coinbaseIcon}>⬡</Text>
                <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                  Connect with Coinbase Wallet
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Apple Sign In */}
          <TouchableOpacity
            onPress={handleApple}
            disabled={isLoading}
            activeOpacity={0.8}
            style={[styles.button, styles.buttonOutline]}
          >
            {activeAction === 'apple' ? (
              <ActivityIndicator size="small" color={theme.colors.textPrimary} />
            ) : (
              <>
                <Text style={styles.appleIcon}></Text>
                <Text style={[styles.buttonText, styles.buttonTextOutline]}>
                  Continue with Apple
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Strava */}
          <TouchableOpacity
            onPress={handleStrava}
            disabled={isLoading}
            activeOpacity={0.8}
            style={[styles.button, styles.buttonStrava]}
          >
            {activeAction === 'strava' ? (
              <ActivityIndicator size="small" color={STRAVA_ORANGE} />
            ) : (
              <>
                <Text style={styles.stravaIcon}>🏃</Text>
                <Text style={[styles.buttonText, styles.buttonTextStrava]}>
                  Connect with Strava
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Social proof */}
        <View style={styles.socialProof}>
          <View style={styles.avatarStack}>
            {['🧑', '👩', '🧔', '👨', '🧑‍🦱'].map((emoji, i) => (
              <View
                key={i}
                style={[styles.miniAvatar, { left: i * 20, zIndex: 5 - i }]}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.socialText}>
            2,400+ athletes competing for $180k+ in stakes
          </Text>
        </View>

        {/* Terms */}
        <View style={styles.terms}>
          <Text style={styles.termsText}>
            By continuing you agree to our{' '}
            <Text style={styles.termsLink} onPress={handleTerms}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.termsLink} onPress={handlePrivacy}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.xxl,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 32,
  },
  bgGlow1: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: theme.colors.accent,
    opacity: 0.06,
    transform: [{ scale: 1.5 }],
  },
  bgGlow2: {
    position: 'absolute',
    bottom: 100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#00FF87',
    opacity: 0.04,
    transform: [{ scale: 1.2 }],
  },
  logoSection: {
    alignItems: 'center',
    gap: theme.spacing.lg,
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}50`,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.accent,
  },
  icon: {
    fontSize: 32,
  },
  wordmark: {
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: 8,
  },
  tagline: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonSection: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
    minHeight: 56,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accent,
    ...theme.shadows.accent,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  buttonStrava: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: `${STRAVA_ORANGE}60`,
  },
  buttonText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextOutline: {
    color: theme.colors.textPrimary,
  },
  buttonTextStrava: {
    color: STRAVA_ORANGE,
  },
  coinbaseIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  appleIcon: {
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  stravaIcon: {
    fontSize: 18,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  socialProof: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  avatarStack: {
    height: 32,
    width: 5 * 20 + 12,
    position: 'relative',
  },
  miniAvatar: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  terms: {
    alignItems: 'center',
  },
  termsText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: theme.colors.accent,
    textDecorationLine: 'underline',
  },
});
