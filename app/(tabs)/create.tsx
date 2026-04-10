import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { PILLARS, getPillarById } from '../../constants/pillars';
import { PillarIcon } from '../../components/PillarIcon';
import { StakeButton } from '../../components/StakeButton';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';

type Step = 1 | 2 | 3 | 4 | 5;
type Privacy = 'public' | 'friends' | 'private';
type Duration = 7 | 14 | 21 | 30 | 'custom';

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 21, label: '21 days' },
  { value: 30, label: '30 days' },
  { value: 'custom', label: 'Custom' },
];

const PRIVACY_OPTIONS: { value: Privacy; label: string; icon: string; desc: string }[] = [
  { value: 'public', label: 'Public', icon: '🌍', desc: 'Anyone can discover and join' },
  { value: 'friends', label: 'Friends Only', icon: '👥', desc: 'Only your followers can join' },
  { value: 'private', label: 'Private Link', icon: '🔒', desc: 'Invite only via shared link' },
];

const STAKE_PRESETS = [0, 5, 10, 25, 50, 100];

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected } = useWallet();

  const [step, setStep] = useState<Step>(1);
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>('');
  const [duration, setDuration] = useState<Duration>(30);
  const [customDuration, setCustomDuration] = useState('');
  const [stake, setStake] = useState<number>(0);
  const [customStake, setCustomStake] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [challengeName, setChallengeName] = useState('');
  const [deploying, setDeploying] = useState(false);

  const pillar = selectedPillar ? getPillarById(selectedPillar) : null;

  const effectiveDuration = useMemo(() => {
    if (duration === 'custom') return parseInt(customDuration, 10) || 0;
    return duration;
  }, [duration, customDuration]);

  const effectiveStake = useMemo(() => {
    if (stake === -1) return parseFloat(customStake) || 0;
    return stake;
  }, [stake, customStake]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return !!selectedPillar;
      case 2: return parseFloat(goal) > 0;
      case 3: return effectiveDuration >= 1 && effectiveDuration <= 365;
      case 4: return effectiveStake >= 0;
      case 5: return true;
      default: return false;
    }
  }, [step, selectedPillar, goal, effectiveDuration, effectiveStake]);

  const autoName = useMemo(() => {
    if (!pillar || !goal) return '';
    const dur = effectiveDuration > 0 ? `${effectiveDuration}-Day` : '';
    return `${dur} ${pillar.name} Challenge: ${goal} ${pillar.unit}`.trim();
  }, [pillar, goal, effectiveDuration]);

  const handleNext = () => {
    if (step < 5) setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else router.back();
  };

  const handleDeploy = useCallback(async () => {
    if (!user?.id || !selectedPillar || !pillar) return;

    if (effectiveStake > 0 && !isConnected) {
      Alert.alert('Wallet Required', 'Connect your Coinbase Wallet to stake USDC.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Connect', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    setDeploying(true);
    try {
      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + effectiveDuration);

      const { data, error } = await supabase.from('challenges').insert({
        creator_id: user.id,
        name: challengeName || autoName,
        pillar_id: selectedPillar,
        goal: parseFloat(goal),
        duration_days: effectiveDuration,
        stake_usdc: effectiveStake,
        privacy,
        total_pot_usdc: effectiveStake,
        participant_count: 1,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'active',
      }).select().single();

      if (error) throw error;

      // Auto-join as creator
      await supabase.from('challenge_participants').insert({
        challenge_id: data.id,
        user_id: user.id,
        progress: 0,
        stake_usdc: effectiveStake,
        completed: false,
        rank: 1,
      });

      router.push(`/challenge/${data.id}`);
    } catch (err: any) {
      Alert.alert('Failed to Deploy', err.message ?? 'Something went wrong. Try again.');
    } finally {
      setDeploying(false);
    }
  }, [
    user?.id,
    selectedPillar,
    pillar,
    goal,
    effectiveDuration,
    effectiveStake,
    privacy,
    challengeName,
    autoName,
    isConnected,
    router,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Challenge</Text>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>{step}/5</Text>
          </View>
        </View>

        {/* Step progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / 5) * 100}%` }]} />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Choose Pillar */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Choose your challenge type</Text>
              <Text style={styles.stepSubtitle}>What will participants track?</Text>

              <View style={styles.pillarGrid}>
                {PILLARS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedPillar(p.id)}
                    activeOpacity={0.75}
                    style={[
                      styles.pillarCell,
                      selectedPillar === p.id && {
                        borderColor: p.color,
                        backgroundColor: p.accentColor,
                      },
                    ]}
                  >
                    <Text style={styles.pillarCellIcon}>{p.icon}</Text>
                    <Text
                      style={[
                        styles.pillarCellName,
                        selectedPillar === p.id && { color: p.color },
                      ]}
                    >
                      {p.name}
                    </Text>
                    <Text style={styles.pillarCellUnit}>{p.unit}</Text>
                    {selectedPillar === p.id && (
                      <View style={[styles.pillarCheck, { backgroundColor: p.color }]}>
                        <Text style={styles.pillarCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {pillar && (
                <View style={[styles.pillarInfoCard, { borderColor: pillar.color + '40' }]}>
                  <Text style={[styles.pillarInfoTitle, { color: pillar.color }]}>
                    {pillar.icon} {pillar.name}
                  </Text>
                  <Text style={styles.pillarInfoDesc}>{pillar.description}</Text>
                  <Text style={styles.pillarInfoSource}>
                    Data via: {pillar.dataSource.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Step 2: Set Goal */}
          {step === 2 && pillar && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Set the target</Text>
              <Text style={styles.stepSubtitle}>
                What's the goal participants must hit?
              </Text>

              <View style={styles.goalInputContainer}>
                <Text style={styles.goalPillarIcon}>{pillar.icon}</Text>
                <TextInput
                  style={styles.goalInput}
                  value={goal}
                  onChangeText={setGoal}
                  placeholder={pillar.goalDefault.toString()}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  returnKeyType="done"
                  autoFocus
                />
                <Text style={styles.goalUnit}>{pillar.unit}</Text>
              </View>

              <Text style={styles.goalHint}>
                Suggested: {pillar.goalDefault} {pillar.unit} · Range: {pillar.goalMin}–{pillar.goalMax}
              </Text>

              {/* Quick presets */}
              <View style={styles.presets}>
                {[pillar.goalMin, pillar.goalDefault, Math.round(pillar.goalMax * 0.5), pillar.goalMax].map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setGoal(v.toString())}
                    style={[
                      styles.preset,
                      goal === v.toString() && styles.presetActive,
                    ]}
                  >
                    <Text style={[styles.presetText, goal === v.toString() && styles.presetTextActive]}>
                      {v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Name override */}
              <View style={styles.nameSection}>
                <Text style={styles.nameLabel}>Challenge name (optional)</Text>
                <TextInput
                  style={styles.nameInput}
                  value={challengeName}
                  onChangeText={setChallengeName}
                  placeholder={autoName || 'Auto-generated from your settings'}
                  placeholderTextColor={theme.colors.textMuted}
                  returnKeyType="done"
                  maxLength={80}
                />
              </View>
            </View>
          )}

          {/* Step 3: Duration */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Set the duration</Text>
              <Text style={styles.stepSubtitle}>How many days does this challenge run?</Text>

              <View style={styles.durationGrid}>
                {DURATION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setDuration(opt.value)}
                    style={[
                      styles.durationOption,
                      duration === opt.value && styles.durationOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationLabel,
                        duration === opt.value && styles.durationLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {duration === 'custom' && (
                <View style={styles.customDurationInput}>
                  <TextInput
                    style={styles.goalInput}
                    value={customDuration}
                    onChangeText={setCustomDuration}
                    placeholder="Enter days (1–365)"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    autoFocus
                    returnKeyType="done"
                  />
                  <Text style={styles.goalUnit}>days</Text>
                </View>
              )}

              {effectiveDuration > 0 && (
                <View style={styles.durationSummary}>
                  <Text style={styles.durationSummaryText}>
                    Challenge runs {effectiveDuration} day{effectiveDuration !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.durationSummarySubtext}>
                    Ends {formatEndDate(effectiveDuration)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Step 4: Stake */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Stake amount</Text>
              <Text style={styles.stepSubtitle}>
                How much USDC to put on the line? Winners split the pot.
              </Text>

              <View style={styles.stakeGrid}>
                {STAKE_PRESETS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    onPress={() => { setStake(amount); setCustomStake(''); }}
                    style={[
                      styles.stakeOption,
                      stake === amount && amount === 0 && styles.stakeOptionFree,
                      stake === amount && amount > 0 && styles.stakeOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stakeAmount,
                        stake === amount && amount > 0 && styles.stakeAmountActive,
                        stake === amount && amount === 0 && styles.stakeAmountFree,
                      ]}
                    >
                      {amount === 0 ? 'Free' : `$${amount}`}
                    </Text>
                    {amount === 0 && (
                      <Text style={styles.stakeDesc}>Reputation only</Text>
                    )}
                  </TouchableOpacity>
                ))}

                {/* Custom stake */}
                <View style={[styles.stakeOption, stake === -1 && styles.stakeOptionActive, { width: '100%' }]}>
                  <Text style={styles.stakeAmount}>Custom</Text>
                  <TextInput
                    style={styles.customStakeInput}
                    value={customStake}
                    onChangeText={(t) => { setCustomStake(t); setStake(-1); }}
                    placeholder="Enter USDC amount"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>
              </View>

              {effectiveStake > 0 && (
                <View style={styles.potPreview}>
                  <Text style={styles.potPreviewLabel}>Estimated pot (10 players)</Text>
                  <Text style={styles.potPreviewAmount}>
                    ${effectiveStake * 10} USDC
                  </Text>
                  <Text style={styles.potPreviewWinner}>
                    Winner takes ~${Math.round(effectiveStake * 10 * 0.9)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Step 5: Privacy */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Who can join?</Text>
              <Text style={styles.stepSubtitle}>Control access to your challenge</Text>

              <View style={styles.privacyOptions}>
                {PRIVACY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setPrivacy(opt.value)}
                    style={[
                      styles.privacyOption,
                      privacy === opt.value && styles.privacyOptionActive,
                    ]}
                  >
                    <View style={styles.privacyLeft}>
                      <Text style={styles.privacyIcon}>{opt.icon}</Text>
                      <View>
                        <Text style={[
                          styles.privacyLabel,
                          privacy === opt.value && styles.privacyLabelActive,
                        ]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.privacyDesc}>{opt.desc}</Text>
                      </View>
                    </View>
                    <View style={[
                      styles.radioOuter,
                      privacy === opt.value && styles.radioOuterActive,
                    ]}>
                      {privacy === opt.value && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Live preview card */}
          {selectedPillar && (
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Preview</Text>
              <View style={[styles.previewCard, { borderColor: (pillar?.color ?? theme.colors.accent) + '40' }]}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewPillarIcon}>{pillar?.icon}</Text>
                  <View style={styles.previewHeaderRight}>
                    <Text style={styles.previewName} numberOfLines={2}>
                      {challengeName || autoName || `${pillar?.name} Challenge`}
                    </Text>
                    <Text style={[styles.previewPillar, { color: pillar?.color }]}>
                      {pillar?.name}
                    </Text>
                  </View>
                </View>
                <View style={styles.previewStats}>
                  <View style={styles.previewStat}>
                    <Text style={styles.previewStatValue}>
                      {goal || '—'} {pillar?.unit}
                    </Text>
                    <Text style={styles.previewStatLabel}>Goal</Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Text style={styles.previewStatValue}>
                      {effectiveDuration > 0 ? `${effectiveDuration}d` : '—'}
                    </Text>
                    <Text style={styles.previewStatLabel}>Duration</Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Text style={[
                      styles.previewStatValue,
                      effectiveStake > 0 ? styles.stakeValueGreen : styles.stakeValueGray,
                    ]}>
                      {effectiveStake > 0 ? `$${effectiveStake}` : 'Free'}
                    </Text>
                    <Text style={styles.previewStatLabel}>Stake</Text>
                  </View>
                  <View style={styles.previewStat}>
                    <Text style={styles.previewStatValue}>
                      {privacy === 'public' ? '🌍' : privacy === 'friends' ? '👥' : '🔒'}
                    </Text>
                    <Text style={styles.previewStatLabel}>Access</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 160 }} />
        </ScrollView>

        {/* Bottom action */}
        <View style={styles.bottomBar}>
          {step < 5 ? (
            <TouchableOpacity
              onPress={handleNext}
              disabled={!canProceed}
              style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                Continue → Step {step + 1} of 5
              </Text>
            </TouchableOpacity>
          ) : (
            <StakeButton
              amount={effectiveStake}
              onPress={handleDeploy}
              loading={deploying}
              label={deploying ? 'Deploying...' : `Deploy Challenge${effectiveStake > 0 ? ` · $${effectiveStake} USDC` : ''}`}
              style={styles.deployButton}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatEndDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  headerTitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  stepIndicator: {
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  stepText: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  progressBar: {
    height: 2,
    backgroundColor: theme.colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
  },
  scroll: {
    flex: 1,
  },
  stepContent: {
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  stepTitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  stepSubtitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: -theme.spacing.md,
  },
  // Pillar grid
  pillarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  pillarCell: {
    width: '47%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    position: 'relative',
  },
  pillarCellIcon: {
    fontSize: 28,
  },
  pillarCellName: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },
  pillarCellUnit: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
  },
  pillarCheck: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarCheckText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pillarInfoCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  pillarInfoTitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    fontWeight: '700',
  },
  pillarInfoDesc: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  pillarInfoSource: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
  },
  // Goal step
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  goalPillarIcon: {
    fontSize: 24,
  },
  goalInput: {
    flex: 1,
    fontFamily: 'JetBrainsMono',
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    padding: 0,
  },
  goalUnit: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
  },
  goalHint: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  presets: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  preset: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  presetActive: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
  },
  presetText: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  presetTextActive: {
    color: theme.colors.accent,
  },
  nameSection: {
    gap: theme.spacing.sm,
  },
  nameLabel: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  nameInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
  },
  // Duration step
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  durationOption: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  durationOptionActive: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
  },
  durationLabel: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  durationLabelActive: {
    color: theme.colors.accent,
  },
  customDurationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  durationSummary: {
    backgroundColor: theme.colors.accentMuted,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  durationSummaryText: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  durationSummarySubtext: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  // Stake step
  stakeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  stakeOption: {
    width: '30%',
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  stakeOptionActive: {
    backgroundColor: theme.colors.winMuted,
    borderColor: theme.colors.win,
  },
  stakeOptionFree: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.textMuted,
  },
  stakeAmount: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  stakeAmountActive: {
    color: theme.colors.win,
  },
  stakeAmountFree: {
    color: theme.colors.textMuted,
  },
  stakeDesc: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
  },
  customStakeInput: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    padding: theme.spacing.sm,
    width: '100%',
    textAlign: 'center',
  },
  potPreview: {
    backgroundColor: theme.colors.winMuted,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: `${theme.colors.win}30`,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  potPreviewLabel: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  potPreviewAmount: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.win,
  },
  potPreviewWinner: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  // Privacy step
  privacyOptions: {
    gap: theme.spacing.md,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  privacyOptionActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  privacyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  privacyIcon: {
    fontSize: 24,
  },
  privacyLabel: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  privacyLabelActive: {
    color: theme.colors.accent,
  },
  privacyDesc: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: theme.colors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent,
  },
  // Preview card
  previewSection: {
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  previewLabel: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  previewCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  previewPillarIcon: {
    fontSize: 28,
  },
  previewHeaderRight: {
    flex: 1,
    gap: 4,
  },
  previewName: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  previewPillar: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  previewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  previewStat: {
    alignItems: 'center',
    gap: 2,
  },
  previewStatValue: {
    fontFamily: 'JetBrainsMono',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  previewStatLabel: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
  },
  stakeValueGreen: {
    color: theme.colors.win,
  },
  stakeValueGray: {
    color: theme.colors.textMuted,
  },
  // Bottom bar
  bottomBar: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  nextButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...theme.shadows.accent,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  deployButton: {
    width: '100%',
  },
});
