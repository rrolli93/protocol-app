import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useChallenges, usePublicChallenges, getPillarEmoji } from '../../hooks/useChallenge';
import { Challenge } from '../../lib/supabase';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function getDaysRemaining(endsAt: string): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
}

function getProgress(challenge: Challenge): number {
  // Returns 0 until real progress syncing is implemented
  return 0;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatBadge: React.FC<{ label: string; value: string | number; color?: string }> = ({
  label,
  value,
  color = C.textPrimary,
}) => (
  <View style={styles.statBadge}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Active Challenge Card ────────────────────────────────────────────────────
const ActiveCard: React.FC<{ item: Challenge; onPress: () => void }> = ({ item, onPress }) => {
  const emoji = getPillarEmoji(item.pillar_id);
  const daysLeft = getDaysRemaining(item.ends_at);
  const progress = getProgress(item);
  const progressPct = Math.min(100, Math.round(progress * 100));

  return (
    <TouchableOpacity style={styles.activeCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.activeCardTop}>
        <Text style={styles.activeCardEmoji}>{emoji}</Text>
        <View style={styles.activeCardBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeCardBadgeText}>ACTIVE</Text>
        </View>
      </View>

      <Text style={styles.activeCardName} numberOfLines={2}>{item.name}</Text>

      <View style={styles.activeCardMeta}>
        <Text style={styles.metaChip}>👥 {item.participant_count}</Text>
        {item.total_pot_usdc > 0 && (
          <Text style={[styles.metaChip, { color: C.success }]}>${item.total_pot_usdc} USDC</Text>
        )}
        <Text style={[styles.metaChip, daysLeft <= 2 ? { color: C.error } : {}]}>
          {daysLeft}d left
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{progressPct}% complete</Text>
    </TouchableOpacity>
  );
};

// ─── Trending Card ────────────────────────────────────────────────────────────
const TrendingCard: React.FC<{ item: Challenge; rank: number; onPress: () => void }> = ({
  item,
  rank,
  onPress,
}) => {
  const emoji = getPillarEmoji(item.pillar_id);
  return (
    <TouchableOpacity style={styles.trendingCard} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.trendingRank}>#{rank}</Text>
      <Text style={styles.trendingEmoji}>{emoji}</Text>
      <View style={styles.trendingInfo}>
        <Text style={styles.trendingName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.trendingMeta}>
          {item.participant_count} players · ${item.total_pot_usdc} pot
        </Text>
      </View>
      <Text style={styles.trendingArrow}>›</Text>
    </TouchableOpacity>
  );
};

// ─── Home Screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const {
    challenges: activeChallenges,
    loading: activeLoading,
    refresh: refreshActive,
    isRefetching: activeRefetching,
  } = useChallenges(user?.id);

  const {
    challenges: allPublic,
    loading: trendingLoading,
    refresh: refreshTrending,
  } = usePublicChallenges();

  const trendingChallenges = allPublic.slice(0, 3);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshActive(), refreshTrending()]);
    setRefreshing(false);
  }, [refreshActive, refreshTrending]);

  const username = profile?.username ?? user?.email?.split('@')[0] ?? 'athlete';
  const totalWon = profile?.challenges_won ?? 0;
  const totalEarned = profile?.total_earned_usdc ?? 0;
  const activeCount = activeChallenges.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>PROTOCOL</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/(tabs)/create')}
          activeOpacity={0.75}
        >
          <Text style={styles.headerBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.primary}
          />
        }
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingText}>
            Good {getTimeOfDay()},{' '}
            <Text style={styles.greetingName}>{username}</Text> 👋
          </Text>
          <Text style={styles.greetingSubtext}>
            {activeCount > 0
              ? `You have ${activeCount} active challenge${activeCount !== 1 ? 's' : ''}`
              : 'No active challenges — start one!'}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatBadge label="Active" value={activeCount} color={C.primary} />
          <View style={styles.statDivider} />
          <StatBadge label="Won" value={totalWon} color={C.success} />
          <View style={styles.statDivider} />
          <StatBadge
            label="Earned"
            value={`$${totalEarned.toFixed(0)}`}
            color={C.success}
          />
        </View>

        {/* My Active Challenges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Active Challenges</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.sectionAction}>See All</Text>
            </TouchableOpacity>
          </View>

          {activeLoading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.primary} />
            </View>
          ) : activeChallenges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTitle}>No Active Challenges</Text>
              <Text style={styles.emptySubtext}>
                Join a challenge and start earning USDC
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <Text style={styles.emptyActionText}>Explore Challenges →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={activeChallenges}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <ActiveCard
                  item={item}
                  onPress={() => router.push(`/challenge/${item.id}`)}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          )}
        </View>

        {/* Trending */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 Trending</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.sectionAction}>View All</Text>
            </TouchableOpacity>
          </View>

          {trendingLoading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.primary} />
            </View>
          ) : (
            <View style={styles.trendingList}>
              {trendingChallenges.map((item, idx) => (
                <TrendingCard
                  key={item.id}
                  item={item}
                  rank={idx + 1}
                  onPress={() => router.push(`/challenge/${item.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/create')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLogo: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 4,
  },
  headerBtn: {
    backgroundColor: C.primaryMuted,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: `${C.primary}40`,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.primary,
  },
  scroll: {
    flex: 1,
  },
  greetingSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
    lineHeight: 28,
  },
  greetingName: {
    color: C.primary,
  },
  greetingSubtext: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  statBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: C.textSecondary,
  },
  statDivider: {
    width: 1,
    marginVertical: 12,
    backgroundColor: C.border,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
  },
  sectionAction: {
    fontSize: 13,
    color: C.primary,
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: 20,
  },
  loadingBox: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textPrimary,
  },
  emptySubtext: {
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
  },
  emptyActionBtn: {
    marginTop: 4,
  },
  emptyActionText: {
    fontSize: 13,
    color: C.primary,
    fontWeight: '600',
  },
  // Active Card
  activeCard: {
    width: 230,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 8,
  },
  activeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeCardEmoji: {
    fontSize: 28,
  },
  activeCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${C.success}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: `${C.success}30`,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  activeCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.success,
    letterSpacing: 0.5,
  },
  activeCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
    lineHeight: 20,
  },
  activeCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '500',
  },
  progressTrack: {
    height: 4,
    backgroundColor: `${C.primary}25`,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 10,
    color: C.textSecondary,
  },
  // Trending Card
  trendingList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  trendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  trendingRank: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
    width: 24,
    textAlign: 'center',
  },
  trendingEmoji: {
    fontSize: 24,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
  },
  trendingMeta: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  trendingArrow: {
    fontSize: 20,
    color: C.textSecondary,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 34,
  },
});
