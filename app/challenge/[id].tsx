import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChallenge, useJoinChallenge, getPillarEmoji } from '../../hooks/useChallenge';
import { useAuth } from '../../hooks/useAuth';
import { LeaderboardEntry } from '../../lib/supabase';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysRemaining(endsAt: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000)
  );
}

function isEnded(endsAt: string): boolean {
  return new Date(endsAt).getTime() < Date.now();
}

function getRankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

// ─── Linear Progress Bar ──────────────────────────────────────────────────────
const ProgressBar: React.FC<{
  progress: number; // 0-1
  color?: string;
  height?: number;
}> = ({ progress, color = C.primary, height = 6 }) => {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  return (
    <View style={[styles.progressTrack, { height }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${pct}%`, backgroundColor: color, height },
        ]}
      />
    </View>
  );
};

// ─── Leaderboard Row ─────────────────────────────────────────────────────────
const LeaderRow: React.FC<{
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  pillarColor: string;
}> = ({ entry, isCurrentUser, pillarColor }) => {
  const progressRatio =
    entry.target > 0 ? entry.progress / entry.target : 0;
  const initials = (entry.user?.username ?? 'U').slice(0, 2).toUpperCase();

  return (
    <View
      style={[
        styles.leaderRow,
        isCurrentUser && styles.leaderRowHighlight,
      ]}
    >
      {/* Rank */}
      <Text style={styles.leaderRank}>{getRankMedal(entry.rank)}</Text>

      {/* Avatar */}
      <View
        style={[
          styles.leaderAvatar,
          isCurrentUser && { borderColor: pillarColor },
        ]}
      >
        <Text style={styles.leaderAvatarText}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.leaderInfo}>
        <View style={styles.leaderNameRow}>
          <Text style={styles.leaderName} numberOfLines={1}>
            {entry.user?.username ?? 'Anonymous'}
          </Text>
          {isCurrentUser && (
            <Text style={styles.youLabel}>YOU</Text>
          )}
          {entry.completed && (
            <Text style={styles.completedLabel}>✓</Text>
          )}
        </View>

        <View style={styles.leaderProgressRow}>
          <ProgressBar
            progress={progressRatio}
            color={entry.completed ? C.success : pillarColor}
            height={4}
          />
          <Text style={styles.leaderProgressText}>
            {Math.round(progressRatio * 100)}%
          </Text>
        </View>
      </View>

      {/* Stake */}
      {entry.stake > 0 && (
        <Text style={styles.leaderStake}>${entry.stake}</Text>
      )}
    </View>
  );
};

// ─── Challenge Detail Screen ──────────────────────────────────────────────────
export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);

  const {
    challenge,
    leaderboard,
    myEntry,
    loading,
    error,
    refresh,
  } = useChallenge(id ?? '', user?.id);

  const joinMutation = useJoinChallenge();

  const pillarEmoji = challenge ? getPillarEmoji(challenge.pillar_id) : '🏆';
  const pillarColor = C.primary; // could derive from pillar_id if needed
  const ended = challenge ? isEnded(challenge.ends_at) : false;
  const daysLeft = challenge ? getDaysRemaining(challenge.ends_at) : 0;
  const hasJoined = !!myEntry;
  const userProgress = myEntry?.progress ?? 0;
  const progressRatio = challenge && challenge.goal > 0
    ? userProgress / challenge.goal
    : 0;
  const totalWinners = leaderboard.filter((e) => e.completed).length;

  const handleJoin = useCallback(async () => {
    if (!user?.id || !challenge) return;
    setJoining(true);
    try {
      await joinMutation.mutateAsync({
        challenge_id: challenge.id,
        user_id: user.id,
        stake_usdc: challenge.stake_usdc,
      });
      Alert.alert('Joined! 🎉', `You've joined "${challenge.name}". Good luck!`);
      refresh();
    } catch (err: any) {
      Alert.alert('Could not join', err?.message ?? 'Try again later.');
    } finally {
      setJoining(false);
    }
  }, [user?.id, challenge, joinMutation, refresh]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading challenge...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error || !challenge) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>
            {(error as any)?.message ?? 'Challenge not found.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refresh()}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {challenge.name}
        </Text>
        <Text style={styles.headerEmoji}>{pillarEmoji}</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{pillarEmoji}</Text>
          <Text style={styles.heroName}>{challenge.name}</Text>

          {/* Status badge */}
          <View style={styles.statusRow}>
            {ended ? (
              <View style={[styles.statusBadge, styles.statusEnded]}>
                <Text style={styles.statusEndedText}>⛔ ENDED</Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, styles.statusActive]}>
                <View style={styles.statusDot} />
                <Text style={styles.statusActiveText}>
                  {daysLeft === 0 ? 'Ending today' : `${daysLeft}d remaining`}
                </Text>
              </View>
            )}
          </View>

          {/* Stats row */}
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: C.success }]}>
                ${challenge.total_pot_usdc.toLocaleString()}
              </Text>
              <Text style={styles.heroStatLabel}>Total Pot</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {challenge.participant_count}
              </Text>
              <Text style={styles.heroStatLabel}>Players</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {challenge.stake_usdc > 0 ? `$${challenge.stake_usdc}` : 'Free'}
              </Text>
              <Text style={styles.heroStatLabel}>Entry</Text>
            </View>
          </View>
        </View>

        {/* ── Your Progress ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR PROGRESS</Text>
          <View style={styles.progressCard}>
            {hasJoined ? (
              <>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressPercent}>
                    {Math.round(progressRatio * 100)}%
                  </Text>
                  <Text style={styles.progressValues}>
                    {userProgress.toLocaleString()} / {challenge.goal.toLocaleString()}
                  </Text>
                </View>
                <ProgressBar
                  progress={progressRatio}
                  color={progressRatio >= 1 ? C.success : C.primary}
                  height={8}
                />
                {progressRatio >= 1 && (
                  <Text style={styles.completedBanner}>🏆 Goal completed!</Text>
                )}
              </>
            ) : (
              <View style={styles.notJoinedBox}>
                <Text style={styles.notJoinedIcon}>👀</Text>
                <Text style={styles.notJoinedText}>
                  Join this challenge to track your progress
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Leaderboard ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEADERBOARD</Text>

          {leaderboard.length === 0 ? (
            <View style={styles.emptyLeaderboard}>
              <Text style={styles.emptyLeaderboardIcon}>🏆</Text>
              <Text style={styles.emptyLeaderboardText}>
                No participants yet. Be the first!
              </Text>
            </View>
          ) : (
            <View style={styles.leaderboard}>
              {leaderboard.map((entry) => (
                <LeaderRow
                  key={entry.user?.id ?? String(entry.rank)}
                  entry={entry}
                  isCurrentUser={entry.user?.id === user?.id}
                  pillarColor={pillarColor}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Settlement (ended) ───────────────────────────────────────────── */}
        {ended && (
          <View style={styles.section}>
            <View style={styles.settlementCard}>
              <Text style={styles.settlementTitle}>Challenge Ended</Text>
              <Text style={styles.settlementBody}>
                {totalWinners > 0
                  ? `${totalWinners} winner${totalWinners !== 1 ? 's' : ''} shared the $${challenge.total_pot_usdc} USDC pot.`
                  : 'No one met the goal. Stakes returned.'}
              </Text>
              {myEntry?.completed && (
                <View style={styles.wonBanner}>
                  <Text style={styles.wonBannerText}>🏆 You won!</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Join CTA ─────────────────────────────────────────────────────── */}
        {!ended && !hasJoined && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.joinBtn, joining && styles.joinBtnLoading]}
              onPress={handleJoin}
              activeOpacity={0.85}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.joinBtnText}>
                    {challenge.stake_usdc > 0
                      ? `Stake $${challenge.stake_usdc} & Join`
                      : 'Join Challenge'}
                  </Text>
                  <Text style={styles.joinBtnSub}>
                    Winners split the ${challenge.total_pot_usdc + challenge.stake_usdc} pot
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {hasJoined && !ended && (
          <View style={styles.section}>
            <View style={styles.joinedBanner}>
              <Text style={styles.joinedBannerText}>✓ You're in this challenge</Text>
            </View>
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
    backgroundColor: C.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    color: C.textSecondary,
  },
  errorIcon: {
    fontSize: 40,
  },
  errorText: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: C.primaryMuted,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${C.primary}40`,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
  },
  headerEmoji: {
    fontSize: 22,
  },
  scroll: {
    flex: 1,
  },
  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  heroEmoji: {
    fontSize: 52,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
  },
  statusRow: {
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: `${C.success}10`,
    borderColor: `${C.success}40`,
  },
  statusEnded: {
    backgroundColor: `${C.error}10`,
    borderColor: `${C.error}40`,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  statusActiveText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.success,
  },
  statusEndedText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.error,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 8,
    width: '100%',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 3,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
  },
  heroStatLabel: {
    fontSize: 11,
    color: C.textSecondary,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.border,
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
    letterSpacing: 1.2,
  },
  // Progress card
  progressCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  progressPercent: {
    fontSize: 32,
    fontWeight: '700',
    color: C.primary,
  },
  progressValues: {
    fontSize: 13,
    color: C.textSecondary,
  },
  progressTrack: {
    backgroundColor: `${C.primary}20`,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 4,
  },
  completedBanner: {
    fontSize: 14,
    fontWeight: '700',
    color: C.success,
    textAlign: 'center',
  },
  notJoinedBox: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  notJoinedIcon: {
    fontSize: 28,
  },
  notJoinedText: {
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
  },
  // Leaderboard
  leaderboard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  leaderRowHighlight: {
    backgroundColor: `${C.primary}08`,
  },
  leaderRank: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSecondary,
    width: 28,
    textAlign: 'center',
  },
  leaderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.border,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
  },
  leaderInfo: {
    flex: 1,
    gap: 4,
  },
  leaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaderName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textPrimary,
    flex: 1,
  },
  youLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primary,
    backgroundColor: C.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  completedLabel: {
    fontSize: 12,
    color: C.success,
    fontWeight: '700',
  },
  leaderProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaderProgressText: {
    fontSize: 10,
    color: C.textSecondary,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
  leaderStake: {
    fontSize: 12,
    fontWeight: '700',
    color: C.success,
  },
  emptyLeaderboard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyLeaderboardIcon: {
    fontSize: 32,
  },
  emptyLeaderboardText: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
  },
  // Settlement
  settlementCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    gap: 8,
    alignItems: 'center',
  },
  settlementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
  },
  settlementBody: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  wonBanner: {
    backgroundColor: `${C.success}15`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${C.success}40`,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  wonBannerText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.success,
  },
  // Join CTA
  joinBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
    minHeight: 58,
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  joinBtnLoading: {
    opacity: 0.7,
  },
  joinBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  joinBtnSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  joinedBanner: {
    backgroundColor: `${C.success}12`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${C.success}40`,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinedBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.success,
  },
});
