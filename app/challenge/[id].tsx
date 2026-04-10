import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Clipboard,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../../constants/theme';
import { getPillarById } from '../../constants/pillars';
import { LeaderboardRow } from '../../components/LeaderboardRow';
import { StakeButton } from '../../components/StakeButton';
import { PillarIcon } from '../../components/PillarIcon';
import { useChallenge } from '../../hooks/useChallenge';
import { useAuth } from '../../hooks/useAuth';
import { LeaderboardEntry } from '../../lib/supabase';

// ─── Circular Progress Ring (SVG) ────────────────────────────────────────────

interface CircularProgressProps {
  progress: number; // 0–1
  size?: number;
  strokeWidth?: number;
  color: string;
  label?: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 160,
  strokeWidth = 10,
  color,
  currentValue,
  targetValue,
  unit,
}) => {
  const clamp = Math.min(1, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamp);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={`${color}25`}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>

      {/* Center content */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: theme.typography.fontFamily.mono,
            fontSize: theme.typography.fontSize.xxxl,
            fontWeight: theme.typography.fontWeight.bold,
            color: color,
            lineHeight: 38,
          }}
        >
          {Math.round(clamp * 100)}%
        </Text>
        <Text
          style={{
            fontFamily: theme.typography.fontFamily.mono,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary,
            marginTop: 4,
          }}
        >
          {currentValue.toLocaleString()} / {targetValue.toLocaleString()}
        </Text>
        <Text
          style={{
            fontFamily: theme.typography.fontFamily.ui,
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.textMuted,
          }}
        >
          {unit}
        </Text>
      </View>
    </View>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysRemaining(endsAt: string): number {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

function isEnded(endsAt: string): boolean {
  return new Date(endsAt).getTime() < Date.now();
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [staking, setStaking] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    challenge,
    leaderboard,
    myEntry,
    loading,
    error,
    refresh,
  } = useChallenge(id ?? '', user?.id);

  const pillar = challenge ? getPillarById(challenge.pillar_id) : null;
  const ended = challenge ? isEnded(challenge.ends_at) : false;
  const daysLeft = challenge ? getDaysRemaining(challenge.ends_at) : 0;
  const hasStaked = !!myEntry;
  const userProgress = myEntry?.progress ?? 0;
  const progressRatio = challenge ? userProgress / challenge.goal : 0;
  const totalWinners = leaderboard.filter((e) => e.completed).length;

  const handleCopyContract = useCallback(() => {
    if (!challenge?.contract_address) return;
    Clipboard.setString(challenge.contract_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [challenge?.contract_address]);

  const handleStake = useCallback(async () => {
    if (!challenge) return;
    setStaking(true);
    try {
      // TODO: wire up wagmi + USDC approve + contract joinChallenge
      await new Promise((res) => setTimeout(res, 1500)); // placeholder
      Alert.alert('Staked!', `You've staked $${challenge.stake_usdc} USDC. Good luck!`);
      await refresh();
    } catch (err) {
      Alert.alert('Stake Failed', 'Could not process your stake. Please try again.');
    } finally {
      setStaking(false);
    }
  }, [challenge, refresh]);

  // ── Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state
  if (error || !challenge) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>
            {error?.message ?? 'Challenge not found.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {challenge.name}
          </Text>
        </View>

        {pillar && <PillarIcon pillarId={challenge.pillar_id} size="sm" />}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Time Remaining Pill ──────────────────────────────────────────── */}
        <View style={styles.timePillRow}>
          {ended ? (
            <View style={[styles.timePill, styles.timePillEnded]}>
              <Text style={styles.timePillEndedText}>⛔ ENDED</Text>
            </View>
          ) : (
            <View style={[styles.timePill, styles.timePillActive]}>
              <View style={styles.timePillDot} />
              <Text style={styles.timePillText}>
                {daysLeft === 0 ? 'Ending today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Progress Ring ─────────────────────────────────────────────────── */}
        <View style={styles.progressSection}>
          <Text style={styles.sectionLabel}>YOUR PROGRESS</Text>
          <CircularProgress
            progress={progressRatio}
            size={180}
            strokeWidth={12}
            color={pillar?.color ?? theme.colors.accent}
            currentValue={userProgress}
            targetValue={challenge.goal}
            unit={pillar?.unit ?? ''}
          />
          {!hasStaked && !ended && (
            <Text style={styles.progressNote}>
              Join this challenge to track your progress
            </Text>
          )}
        </View>

        {/* ── Stake Info Bar ───────────────────────────────────────────────── */}
        <View style={styles.stakeBar}>
          <View style={styles.stakeBarItem}>
            <Text style={styles.stakeBarValue}>
              ${challenge.total_pot_usdc.toLocaleString()}
            </Text>
            <Text style={styles.stakeBarLabel}>Total Pot</Text>
          </View>
          <View style={styles.stakeBarDivider} />
          <View style={styles.stakeBarItem}>
            <Text style={styles.stakeBarValue}>
              {hasStaked ? `$${myEntry!.stake}` : `$${challenge.stake_usdc}`}
            </Text>
            <Text style={styles.stakeBarLabel}>
              {hasStaked ? 'Your Stake' : 'Entry Fee'}
            </Text>
          </View>
          <View style={styles.stakeBarDivider} />
          <View style={styles.stakeBarItem}>
            <Text style={styles.stakeBarValue}>{challenge.participant_count}</Text>
            <Text style={styles.stakeBarLabel}>Players</Text>
          </View>
        </View>

        {/* ── Leaderboard ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEADERBOARD</Text>
          {leaderboard.length === 0 ? (
            <View style={styles.emptyLeaderboard}>
              <Text style={styles.emptyLeaderboardIcon}>🏆</Text>
              <Text style={styles.emptyLeaderboardText}>No participants yet.</Text>
              <Text style={styles.emptyLeaderboardSub}>Be the first to stake!</Text>
            </View>
          ) : (
            <View>
              {leaderboard.map((entry: LeaderboardEntry) => (
                <LeaderboardRow
                  key={entry.user.id}
                  rank={entry.rank}
                  user={entry.user}
                  progress={entry.progress}
                  target={entry.target}
                  stake={entry.stake}
                  isCurrentUser={entry.user.id === user?.id}
                  unit={pillar?.unit}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Stake Button (active + not staked) ───────────────────────────── */}
        {!ended && !hasStaked && (
          <View style={styles.stakeCta}>
            <StakeButton
              amount={challenge.stake_usdc}
              onPress={handleStake}
              loading={staking}
              style={styles.stakeButton}
            />
            <Text style={styles.stakeCtaNote}>
              Stake USDC to compete. Winners split the pot.
            </Text>
          </View>
        )}

        {/* ── Settlement Status (ended) ─────────────────────────────────────── */}
        {ended && (
          <View style={styles.settlementCard}>
            <Text style={styles.settlementTitle}>Challenge Ended</Text>
            <Text style={styles.settlementBody}>
              {totalWinners > 0
                ? `${totalWinners} winner${totalWinners !== 1 ? 's' : ''} shared the $${challenge.total_pot_usdc} USDC pot.`
                : 'No winners met the goal. Stakes returned.'}
            </Text>
            {myEntry?.completed && (
              <View style={styles.wonBanner}>
                <Text style={styles.wonBannerText}>🏆 You won!</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Smart Contract Address ───────────────────────────────────────── */}
        {challenge.contract_address && (
          <View style={styles.contractSection}>
            <Text style={styles.contractLabel}>Smart Contract</Text>
            <TouchableOpacity
              onPress={handleCopyContract}
              activeOpacity={0.7}
              style={styles.contractRow}
            >
              <Text style={styles.contractIcon}>⬡</Text>
              <Text style={styles.contractAddress}>
                {truncateAddress(challenge.contract_address)}
              </Text>
              <Text style={[styles.copyLabel, copied && styles.copiedLabel]}>
                {copied ? '✓ Copied' : '⎘ Copy'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.contractNetwork}>Base Mainnet</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  errorIcon: {
    fontSize: 40,
  },
  errorText: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}40`,
  },
  retryText: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.accent,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  backButton: {
    padding: theme.spacing.sm,
  },
  backIcon: {
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  // Time Pill
  timePillRow: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.sm,
    borderWidth: 1,
  },
  timePillActive: {
    backgroundColor: `${theme.colors.win}10`,
    borderColor: `${theme.colors.win}40`,
  },
  timePillEnded: {
    backgroundColor: theme.colors.lossMuted,
    borderColor: `${theme.colors.loss}40`,
  },
  timePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.win,
  },
  timePillText: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.win,
  },
  timePillEndedText: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.loss,
  },
  // Progress
  progressSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  progressNote: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Stake Bar
  stakeBar: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.xxl,
    ...theme.shadows.card,
  },
  stakeBarItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: 4,
  },
  stakeBarValue: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  stakeBarLabel: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stakeBarDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  // Sections
  section: {
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
  },
  sectionLabel: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    marginBottom: theme.spacing.md,
  },
  // Leaderboard
  emptyLeaderboard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    padding: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyLeaderboardIcon: {
    fontSize: 32,
  },
  emptyLeaderboardText: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  emptyLeaderboardSub: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  // Stake CTA
  stakeCta: {
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  stakeButton: {
    width: '100%',
  },
  stakeCtaNote: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Settlement
  settlementCard: {
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  settlementTitle: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  settlementBody: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  wonBanner: {
    backgroundColor: theme.colors.winMuted,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: `${theme.colors.win}40`,
    ...theme.shadows.win,
  },
  wonBannerText: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.win,
    textAlign: 'center',
  },
  // Contract
  contractSection: {
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  contractLabel: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  contractIcon: {
    fontSize: 14,
    color: theme.colors.usdc,
  },
  contractAddress: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    letterSpacing: 0.3,
  },
  copyLabel: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.accent,
    fontWeight: theme.typography.fontWeight.medium,
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  copiedLabel: {
    color: theme.colors.win,
    backgroundColor: theme.colors.winMuted,
  },
  contractNetwork: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
});
