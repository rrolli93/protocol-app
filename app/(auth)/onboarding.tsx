import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';

type Pillar = {
  id: string;
  label: string;
  emoji: string;
  description: string;
};

const PILLARS: Pillar[] = [
  { id: 'run', label: 'Run', emoji: '🏃', description: 'Distance & cardio challenges' },
  { id: 'fast', label: 'Fast', emoji: '⚡', description: 'Intermittent fasting streaks' },
  { id: 'sleep', label: 'Sleep', emoji: '🌙', description: 'Sleep consistency goals' },
  { id: 'meditate', label: 'Meditate', emoji: '🧘', description: 'Mindfulness minutes' },
];

export default function OnboardingScreen() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState<string>('');

  // Fetch current user username for step 3
  const fetchUsername = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await (supabase as any).from('users').select('username').eq('id', user.id).single();
        if (data?.username) setUsername(data.username);
      }
    } catch {
      // non-blocking
    }
  };

  const togglePillar = (id: string) => {
    setSelectedPillars((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= 3) {
        // Replace last selected
        return [...prev.slice(0, 2), id];
      }
      return [...prev, id];
    });
  };

  const handlePillarsContinue = async () => {
    if (selectedPillars.length === 0) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to save preferences — if column doesn't exist, skip silently
        await (supabase as any)
          .from('users')
          .update({ preferences: JSON.stringify({ pillars: selectedPillars }) })
          .eq('id', user.id);
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }

    setStep(2);
  };

  const handleStravaConnect = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any)
          .from('users')
          .update({ strava_connected: false })
          .eq('id', user.id);
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }

    await fetchUsername();
    setStep(3);
  };

  const handleStravaSkip = async () => {
    await fetchUsername();
    setStep(3);
  };

  const handleLetsGo = () => {
    router.push('/(tabs)/');
  };

  // ── Step indicators ──────────────────────────────────────────────────
  const StepDots = () => (
    <View style={styles.stepDots}>
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={[styles.dot, s === step && styles.dotActive, s < step && styles.dotDone]}
        />
      ))}
    </View>
  );

  // ── Step 1: Pillar selection ─────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <View style={styles.container}>
          <StepDots />

          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>What's your vibe?</Text>
            <Text style={styles.stepSubtitle}>Pick up to 3 challenge pillars you want to crush.</Text>
          </View>

          <ScrollView
            style={styles.pillarsScroll}
            contentContainerStyle={styles.pillarsGrid}
            showsVerticalScrollIndicator={false}
          >
            {PILLARS.map((pillar) => {
              const selected = selectedPillars.includes(pillar.id);
              return (
                <TouchableOpacity
                  key={pillar.id}
                  style={[styles.pillarCard, selected && styles.pillarCardSelected]}
                  onPress={() => togglePillar(pillar.id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.pillarEmoji}>{pillar.emoji}</Text>
                  <Text style={[styles.pillarLabel, selected && styles.pillarLabelSelected]}>
                    {pillar.label}
                  </Text>
                  <Text style={styles.pillarDesc}>{pillar.description}</Text>
                  {selected && (
                    <View style={styles.pillarCheck}>
                      <Text style={styles.pillarCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (selectedPillars.length === 0 || loading) && styles.buttonDisabled,
            ]}
            onPress={handlePillarsContinue}
            disabled={selectedPillars.length === 0 || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Continue ({selectedPillars.length} selected)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 2: Connect Strava ───────────────────────────────────────────
  if (step === 2) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <View style={styles.container}>
          <StepDots />

          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>Connect Strava</Text>
            <Text style={styles.stepSubtitle}>
              Link your Strava account to automatically track runs, rides, and outdoor workouts.
            </Text>
          </View>

          <View style={styles.stravaCard}>
            <Text style={styles.stravaEmoji}>🏅</Text>
            <Text style={styles.stravaCardTitle}>Strava Integration</Text>
            <Text style={styles.stravaCardDesc}>
              Auto-sync your activities so challenges verify themselves. No manual logging needed.
            </Text>
          </View>

          <View style={styles.stravaButtons}>
            <TouchableOpacity
              style={[styles.stravaConnectButton, loading && styles.buttonDisabled]}
              onPress={handleStravaConnect}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.stravaIcon}>🏃</Text>
                  <Text style={styles.stravaConnectText}>Connect with Strava</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleStravaSkip}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 3: You're in ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <View style={[styles.container, styles.successContainer]}>
        {/* Background glow */}
        <View style={styles.successGlow} />

        <View style={styles.successContent}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>You're in.</Text>
          {username ? (
            <Text style={styles.successUsername}>@{username}</Text>
          ) : null}
          <Text style={styles.successMessage}>
            Your protocol starts now. Pick a challenge, stake your claim, and prove it.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleLetsGo}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Let's go  →</Text>
        </TouchableOpacity>
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
    paddingTop: 32,
    paddingBottom: 40,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    backgroundColor: theme.colors.accent,
    width: 24,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: theme.colors.win,
  },
  stepHeader: {
    marginBottom: 28,
    gap: theme.spacing.sm,
  },
  stepTitle: {
    fontFamily: 'Inter',
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  stepSubtitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  pillarsScroll: {
    flex: 1,
  },
  pillarsGrid: {
    gap: theme.spacing.md,
    paddingBottom: 16,
  },
  pillarCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    position: 'relative',
  },
  pillarCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  pillarEmoji: {
    fontSize: 32,
  },
  pillarLabel: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    flex: 1,
  },
  pillarLabelSelected: {
    color: theme.colors.textPrimary,
  },
  pillarDesc: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: theme.colors.textMuted,
    position: 'absolute',
    bottom: theme.spacing.md,
    left: 72,
  },
  pillarCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarCheckText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.accent,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  // Strava step
  stravaCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
    padding: theme.spacing.xxl,
  },
  stravaEmoji: {
    fontSize: 48,
  },
  stravaCardTitle: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  stravaCardDesc: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  stravaButtons: {
    gap: theme.spacing.md,
  },
  stravaConnectButton: {
    backgroundColor: '#FC4C02',
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  stravaIcon: {
    fontSize: 18,
  },
  stravaConnectText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  skipButtonText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  // Step 3 — success
  successContainer: {
    justifyContent: 'center',
  },
  successGlow: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: theme.colors.win,
    opacity: 0.07,
    transform: [{ scale: 1.5 }],
  },
  successContent: {
    alignItems: 'center',
    gap: theme.spacing.lg,
    marginBottom: 48,
  },
  successEmoji: {
    fontSize: 64,
  },
  successTitle: {
    fontFamily: 'JetBrainsMono',
    fontSize: 40,
    fontWeight: '700',
    color: theme.colors.win,
    letterSpacing: 2,
  },
  successUsername: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  successMessage: {
    fontFamily: 'Inter',
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.lg,
  },
});
