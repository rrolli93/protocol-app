import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={styles.container}>
        {/* Background glow decorations */}
        <View style={styles.bgGlow1} />
        <View style={styles.bgGlow2} />

        {/* Logo section */}
        <View style={styles.logoSection}>
          <Text style={styles.wordmark}>PROTOCOL</Text>
          <Text style={styles.tagline}>Bet on yourself.</Text>
        </View>

        {/* CTA Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            activeOpacity={0.8}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.buttonTextPrimary}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonOutline]}
            activeOpacity={0.8}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.buttonTextOutline}>Sign In</Text>
          </TouchableOpacity>
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
    paddingTop: 80,
    paddingBottom: 48,
  },
  bgGlow1: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.colors.accent,
    opacity: 0.07,
    transform: [{ scale: 1.5 }],
  },
  bgGlow2: {
    position: 'absolute',
    bottom: 80,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.colors.win,
    opacity: 0.04,
    transform: [{ scale: 1.2 }],
  },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  wordmark: {
    fontFamily: 'JetBrainsMono',
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.accent,
    letterSpacing: 10,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '400',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  buttonSection: {
    gap: theme.spacing.md,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 52,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accent,
    ...theme.shadows.accent,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  buttonTextPrimary: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  buttonTextOutline: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accent,
    letterSpacing: 0.3,
  },
});
