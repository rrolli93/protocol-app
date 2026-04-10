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
import { useAuth } from '../../hooks/useAuth';
import { useCreateChallenge } from '../../hooks/useChallenge';
import { useWallet } from '../../hooks/useWallet';
import { useCreateChallengeOnChain, useWalletBalance } from '../../hooks/useContract';
import { WalletConnect } from '../../components/WalletConnect';
import { supabase } from '../../lib/supabase';
import { BASE_CHAIN_ID } from '../../lib/contracts';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0F',
  primary: '#6C63FF',
  success: '#00FF87',
  error: '#FF4757',
  card: '#0D0D1A',
  border: '#1A1A2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8888AA',
  primaryMuted: 'rgba(108,99,255,0.12)',
  successMuted: 'rgba(0,255,135,0.12)',
};

// ─── Constants ────────────────────────────────────────────────────────────────
type Pillar = 'run' | 'fast' | 'sleep' | 'meditate';
type Privacy = 'public' | 'friends' | 'private';

interface PillarOption {
  id: Pillar;
  label: string;
  emoji: string;
  description: string;
  color: string;
  defaultGoal: number;
  unit: string;
}

const PILLAR_OPTIONS: PillarOption[] = [
  {
    id: 'run',
    label: 'Run',
    emoji: '🏃',
    description: 'Track total kilometers run',
    color: '#FF6B35',
    defaultGoal: 50,
    unit: 'km',
  },
  {
    id: 'fast',
    label: 'Fast',
    emoji: '⚡',
    description: 'Track fasting hours',
    color: '#EC4899',
    defaultGoal: 112,
    unit: 'hrs',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    emoji: '🌙',
    description: 'Average nightly sleep score',
    color: '#6C63FF',
    defaultGoal: 85,
    unit: 'score',
  },
  {
    id: 'meditate',
    label: 'Meditate',
    emoji: '🧘',
    description: 'Total mindful minutes',
    color: '#8B5CF6',
    defaultGoal: 300,
    unit: 'min',
  },
];

const DURATION_OPTIONS = [7, 14, 30, 60] as const;
type Duration = typeof DURATION_OPTIONS[number] | number;

const STAKE_PRESETS = [5, 10, 25, 50] as const;

const PRIVACY_OPTIONS: { value: Privacy; label: string; icon: string; desc: string }[] = [
  { value: 'public', label: 'Public', icon: '🌍', desc: 'Anyone can discover and join' },
  { value: 'friends', label: 'Friends', icon: '👥', desc: 'Only your followers can join' },
  { value: 'private', label: 'Private', icon: '🔒', desc: 'Invite only via shared link' },
];

// ─── Create Screen ────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const createChallenge = useCreateChallenge();
  const { isConnected, chainId, switchToBase, formatAddress, walletAddress } = useWallet();
  const { balance: usdcBalance, formatted: usdcFormatted } = useWalletBalance();
  const onChain = useCreateChallengeOnChain();

  // Deploy state machine: idle | pending | success | error
  const [deployState, setDeployState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [deployError, setDeployError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPillar, setSelectedPillar] = useState<PillarOption | null>(null);
  const [challengeName, setChallengeName] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [duration, setDuration] = useState<Duration>(30);
  const [customDuration, setCustomDuration] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [stake, setStake] = useState<number>(10);
  const [customStake, setCustomStake] = useState('');
  const [useCustomStake, setUseCustomStake] = useState(false);

  const effectiveDuration = duration === 0 && customDuration
    ? parseInt(customDuration, 10) || 0
    : duration;

  const effectiveStake = useCustomStake
    ? parseFloat(customStake) || 0
    : stake;

  const autoName = selectedPillar
    ? `${effectiveDuration}d ${selectedPillar.label} Challenge`
    : '';

  const finalName = challengeName.trim() || autoName;

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return !!selectedPillar;
      case 2: return finalName.length > 0 && effectiveDuration >= 1;
      case 3: return effectiveStake >= 0;
      case 4: return true;
    }
  }, [step, selectedPillar, finalName, effectiveDuration, effectiveStake]);

  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    else router.back();
  };

  const handleDeploy = useCallback(async () => {
    if (!user?.id || !selectedPillar) return;

    // Guard: wallet must be connected for staked challenges
    if (effectiveStake > 0 && !isConnected) {
      Alert.alert('Wallet Required', 'Connect your wallet to stake USDC.');
      return;
    }

    // Guard: must be on Base
    if (effectiveStake > 0 && chainId !== BASE_CHAIN_ID) {
      try {
        await switchToBase();
      } catch {
        Alert.alert('Wrong Network', 'Please switch to Base mainnet.');
        return;
      }
    }

    setDeployState('pending');
    setDeployError(null);

    try {
      // Step 1: Create challenge record in Supabase
      const result = await createChallenge.mutateAsync({
        creator_id: user.id,
        name: finalName,
        pillar_id: selectedPillar.id,
        goal: selectedPillar.defaultGoal,
        duration_days: effectiveDuration,
        stake_usdc: effectiveStake,
        privacy,
      });

      // Step 2: If there's a stake, write to Base
      if (effectiveStake > 0) {
        await onChain.write({
          challengeId: result.id,
          stakeAmountUsdc: effectiveStake,
          durationDays: effectiveDuration,
        });

        // Step 3: Store tx hash in DB as contract_address reference
        if (onChain.txHash) {
          await supabase
            .from('challenges')
            .update({ contract_address: onChain.txHash })
            .eq('id', result.id);
        }
      }

      setDeployState('success');

      // Navigate after brief success flash
      setTimeout(() => {
        router.push(`/challenge/${result.id}`);
      }, 1500);
    } catch (err: any) {
      const msg = onChain.error ?? err?.message ?? 'Something went wrong. Try again.';
      setDeployState('error');
      setDeployError(msg);
      Alert.alert('Deploy Failed', msg);
    }
  }, [
    user?.id, selectedPillar, finalName, effectiveDuration, effectiveStake,
    privacy, createChallenge, onChain, router, isConnected, chainId, switchToBase,
  ]);

  const pillarColor = selectedPillar?.color ?? C.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Challenge</Text>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>{step}/4</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(step / 4) * 100}%`, backgroundColor: pillarColor },
            ]}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 1: Pick Pillar ──────────────────────────────────────────── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Choose your challenge type</Text>
              <Text style={styles.stepSubtitle}>What will participants track?</Text>

              <View style={styles.pillarGrid}>
                {PILLAR_OPTIONS.map((p) => {
                  const isSelected = selectedPillar?.id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.pillarCard,
                        isSelected && {
                          borderColor: p.color,
                          backgroundColor: `${p.color}15`,
                        },
                      ]}
                      onPress={() => setSelectedPillar(p)}
                      activeOpacity={0.8}
                    >
                      {isSelected && (
                        <View style={[styles.pillarCheck, { backgroundColor: p.color }]}>
                          <Text style={styles.pillarCheckText}>✓</Text>
                        </View>
                      )}
                      <Text style={styles.pillarEmoji}>{p.emoji}</Text>
                      <Text style={[styles.pillarLabel, isSelected && { color: p.color }]}>
                        {p.label}
                      </Text>
                      <Text style={styles.pillarDesc}>{p.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Step 2: Name, Goal Description, Duration, Privacy ─────────── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Configure your challenge</Text>
              <Text style={styles.stepSubtitle}>Set the details</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Challenge Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={challengeName}
                  onChangeText={setChallengeName}
                  placeholder={autoName || 'e.g. 30-Day Run Challenge'}
                  placeholderTextColor={C.textSecondary}
                  returnKeyType="next"
                  maxLength={80}
                />
                {autoName && !challengeName && (
                  <Text style={styles.fieldHint}>Auto: "{autoName}"</Text>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Goal Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={goalDescription}
                  onChangeText={setGoalDescription}
                  placeholder="Describe what participants must achieve..."
                  placeholderTextColor={C.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={200}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Duration</Text>
                <View style={styles.durationGrid}>
                  {DURATION_OPTIONS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.durationChip,
                        duration === d && styles.durationChipActive,
                      ]}
                      onPress={() => { setDuration(d); setCustomDuration(''); }}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          duration === d && styles.durationChipTextActive,
                        ]}
                      >
                        {d}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.durationChip,
                      duration === 0 && styles.durationChipActive,
                    ]}
                    onPress={() => setDuration(0)}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        duration === 0 && styles.durationChipTextActive,
                      ]}
                    >
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>

                {duration === 0 && (
                  <TextInput
                    style={[styles.textInput, { marginTop: 8 }]}
                    value={customDuration}
                    onChangeText={setCustomDuration}
                    placeholder="Enter days (1–365)"
                    placeholderTextColor={C.textSecondary}
                    keyboardType="numeric"
                    returnKeyType="done"
                    autoFocus
                  />
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Privacy</Text>
                {PRIVACY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.privacyRow,
                      privacy === opt.value && styles.privacyRowActive,
                    ]}
                    onPress={() => setPrivacy(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.privacyIcon}>{opt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.privacyLabel,
                          privacy === opt.value && { color: C.primary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.privacyDesc}>{opt.desc}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        privacy === opt.value && styles.radioOuterActive,
                      ]}
                    >
                      {privacy === opt.value && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 3: Stake Amount ─────────────────────────────────────────── */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Stake amount</Text>
              <Text style={styles.stepSubtitle}>
                How much USDC to put on the line? Winners split the pot.
              </Text>

              <View style={styles.stakeGrid}>
                {STAKE_PRESETS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={[
                      styles.stakeChip,
                      !useCustomStake && stake === amount && styles.stakeChipActive,
                    ]}
                    onPress={() => { setStake(amount); setUseCustomStake(false); }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.stakeChipText,
                        !useCustomStake && stake === amount && styles.stakeChipTextActive,
                      ]}
                    >
                      ${amount}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[styles.stakeChip, { width: '100%' }, useCustomStake && styles.stakeChipActive]}
                  onPress={() => setUseCustomStake(true)}
                >
                  <Text style={[styles.stakeChipText, useCustomStake && styles.stakeChipTextActive]}>
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {useCustomStake && (
                <TextInput
                  style={[styles.textInput, { marginTop: 12 }]}
                  value={customStake}
                  onChangeText={setCustomStake}
                  placeholder="Enter USDC amount"
                  placeholderTextColor={C.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="done"
                  autoFocus
                />
              )}

              {effectiveStake > 0 && (
                <View style={styles.potPreview}>
                  <Text style={styles.potPreviewLabel}>Estimated pot (10 players)</Text>
                  <Text style={styles.potPreviewAmount}>${effectiveStake * 10} USDC</Text>
                  <Text style={styles.potPreviewWinner}>
                    Winner takes ~${Math.round(effectiveStake * 10 * 0.9)}
                  </Text>
                </View>
              )}

              <View style={styles.freeOption}>
                <TouchableOpacity
                  style={styles.freeBtn}
                  onPress={() => { setStake(0); setUseCustomStake(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.freeBtnText}>
                    {!useCustomStake && stake === 0 ? '✓ ' : ''}No stake (free / reputation only)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Step 4: Confirm + Deploy ─────────────────────────────────────── */}
          {step === 4 && selectedPillar && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Review & Deploy</Text>
              <Text style={styles.stepSubtitle}>Confirm your challenge details</Text>

              {/* Wallet section — only show when stake > 0 */}
              {effectiveStake > 0 && (
                <View style={styles.walletSection}>
                  {isConnected && walletAddress ? (
                    <View style={styles.walletRow}>
                      <View style={styles.walletInfo}>
                        <View style={styles.walletDot} />
                        <Text style={styles.walletAddr}>{formatAddress(walletAddress)}</Text>
                      </View>
                      <View style={styles.usdcPill}>
                        <Text style={styles.usdcPillText}>
                          ${parseFloat(usdcFormatted).toFixed(2)} USDC
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <WalletConnect
                      title="Connect to stake USDC"
                      subtitle={`You need ${effectiveStake} USDC to deploy this challenge.`}
                    />
                  )}
                  {isConnected && parseFloat(usdcFormatted) < effectiveStake && (
                    <View style={styles.insufficientBanner}>
                      <Text style={styles.insufficientText}>
                        ⚠️ Insufficient USDC balance. You need ${effectiveStake} USDC.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.confirmCard, { borderColor: `${pillarColor}40` }]}>
                {/* Pillar hero */}
                <View style={[styles.confirmHero, { backgroundColor: `${pillarColor}15` }]}>
                  <Text style={styles.confirmEmoji}>{selectedPillar.emoji}</Text>
                  <View>
                    <Text style={[styles.confirmPillar, { color: pillarColor }]}>
                      {selectedPillar.label.toUpperCase()}
                    </Text>
                    <Text style={styles.confirmName} numberOfLines={2}>{finalName}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.confirmDetails}>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>Duration</Text>
                    <Text style={styles.confirmRowValue}>
                      {effectiveDuration} day{effectiveDuration !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.confirmDivider} />
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>Stake</Text>
                    <Text style={[styles.confirmRowValue, effectiveStake > 0 && { color: C.success }]}>
                      {effectiveStake > 0 ? `$${effectiveStake} USDC` : 'Free'}
                    </Text>
                  </View>
                  <View style={styles.confirmDivider} />
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>Privacy</Text>
                    <Text style={styles.confirmRowValue}>{privacy}</Text>
                  </View>
                  {goalDescription.trim().length > 0 && (
                    <>
                      <View style={styles.confirmDivider} />
                      <View style={styles.confirmRow}>
                        <Text style={styles.confirmRowLabel}>Goal</Text>
                        <Text style={[styles.confirmRowValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                          {goalDescription}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              <TouchableOpacity
              {/* Deploy button — changes with state */}
              {deployState === 'success' ? (
                <View style={[styles.deployBtn, styles.deployBtnSuccess]}>
                  <Text style={styles.deployBtnText}>✅ Challenge live on Base!</Text>
                </View>
              ) : deployState === 'pending' ? (
                <View style={[styles.deployBtn, { backgroundColor: pillarColor }, styles.deployBtnLoading]}>
                  <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.deployBtnText}>Deploying to Base...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.deployBtn,
                    { backgroundColor: pillarColor },
                    (createChallenge.isPending || onChain.isLoading) && styles.deployBtnLoading,
                  ]}
                  onPress={handleDeploy}
                  activeOpacity={0.85}
                  disabled={createChallenge.isPending || onChain.isLoading}
                >
                  <Text style={styles.deployBtnText}>🚀 Deploy Challenge</Text>
                </TouchableOpacity>
              )}

              {deployState === 'error' && deployError && (
                <View style={styles.deployErrorBox}>
                  <Text style={styles.deployErrorText}>{deployError}</Text>
                </View>
              )}

              <Text style={styles.deployNote}>
                You'll be added as the first participant automatically.
              </Text>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom CTA */}
        {step < 4 && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: pillarColor },
                !canProceed && styles.nextBtnDisabled,
              ]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={!canProceed}
            >
              <Text style={styles.nextBtnText}>
                {step === 3 ? 'Review →' : 'Continue →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: {
    padding: 6,
  },
  backIcon: {
    fontSize: 22,
    color: C.textPrimary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: C.textPrimary,
  },
  stepBadge: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },
  progressBar: {
    height: 2,
    backgroundColor: C.border,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  scroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
  },
  stepSubtitle: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: -12,
  },
  // Pillar Grid
  pillarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pillarCard: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
    gap: 6,
    position: 'relative',
  },
  pillarCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
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
  pillarEmoji: {
    fontSize: 32,
  },
  pillarLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textPrimary,
  },
  pillarDesc: {
    fontSize: 11,
    color: C.textSecondary,
    lineHeight: 15,
  },
  // Fields
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textPrimary,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  fieldHint: {
    fontSize: 11,
    color: C.textSecondary,
    fontStyle: 'italic',
  },
  // Duration
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  durationChipActive: {
    backgroundColor: C.primaryMuted,
    borderColor: C.primary,
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSecondary,
  },
  durationChipTextActive: {
    color: C.primary,
  },
  // Privacy
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  privacyRowActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryMuted,
  },
  privacyIcon: {
    fontSize: 20,
  },
  privacyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
  },
  privacyDesc: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: C.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  // Stake
  stakeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stakeChip: {
    width: '47%',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  stakeChipActive: {
    backgroundColor: C.primaryMuted,
    borderColor: C.primary,
  },
  stakeChipText: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textSecondary,
  },
  stakeChipTextActive: {
    color: C.primary,
  },
  potPreview: {
    backgroundColor: `${C.success}10`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${C.success}30`,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  potPreviewLabel: {
    fontSize: 12,
    color: C.textSecondary,
  },
  potPreviewAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: C.success,
  },
  potPreviewWinner: {
    fontSize: 12,
    color: C.textSecondary,
  },
  freeOption: {
    alignItems: 'center',
  },
  freeBtn: {
    paddingVertical: 10,
  },
  freeBtnText: {
    fontSize: 13,
    color: C.textSecondary,
  },
  // Confirm
  confirmCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  confirmHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  confirmEmoji: {
    fontSize: 40,
  },
  confirmPillar: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  confirmName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    marginTop: 2,
  },
  confirmDetails: {
    padding: 16,
    gap: 0,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  confirmRowLabel: {
    fontSize: 13,
    color: C.textSecondary,
  },
  confirmRowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
    textTransform: 'capitalize',
  },
  confirmDivider: {
    height: 1,
    backgroundColor: C.border,
  },
  deployBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  deployBtnLoading: {
    opacity: 0.7,
  },
  deployBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deployNote: {
    fontSize: 12,
    color: C.textSecondary,
    textAlign: 'center',
  },
  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  nextBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
