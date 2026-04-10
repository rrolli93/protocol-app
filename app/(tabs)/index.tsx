import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { ChallengeCard } from '../../components/ChallengeCard';
import { WalletBadge } from '../../components/WalletBadge';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { useChallenges } from '../../hooks/useChallenge';
import { Challenge } from '../../lib/supabase';

// Mock friends activity data — replace with real feed from Supabase
const FRIENDS_ACTIVITY = [
  {
    id: '1',
    user: { name: 'alex_runs', avatar: null, initials: 'AR' },
    action: 'completed Day 7',
    challenge: '30-Day Run Challenge',
    time: '2m ago',
    pillarIcon: '🏃',
    pillarColor: '#FF6B35',
  },
  {
    id: '2',
    user: { name: 'sleepking', avatar: null, initials: 'SK' },
    action: 'hit sleep score 92',
    challenge: 'Optimal Sleep Protocol',
    time: '14m ago',
    pillarIcon: '😴',
    pillarColor: '#6C63FF',
  },
  {
    id: '3',
    user: { name: 'fasted_beast', avatar: null, initials: 'FB' },
    action: 'logged 18hr fast',
    challenge: 'Weekly Fast Challenge',
    time: '1h ago',
    pillarIcon: '⚡',
    pillarColor: '#EC4899',
  },
  {
    id: '4',
    user: { name: 'mindful_m', avatar: null, initials: 'MM' },
    action: 'meditated 20 minutes',
    challenge: 'Meditation Streak',
    time: '3h ago',
    pillarIcon: '🧘',
    pillarColor: '#8B5CF6',
  },
];

interface FriendActivityItemProps {
  item: typeof FRIENDS_ACTIVITY[0];
}

const FriendActivityItem: React.FC<FriendActivityItemProps> = ({ item }) => (
  <View style={styles.activityItem}>
    <View style={styles.activityAvatarWrap}>
      <View style={[styles.activityAvatar, { borderColor: item.pillarColor }]}>
        <Text style={styles.activityAvatarText}>{item.user.initials}</Text>
      </View>
      <View style={[styles.activityPillarDot, { backgroundColor: item.pillarColor }]}>
        <Text style={{ fontSize: 8 }}>{item.pillarIcon}</Text>
      </View>
    </View>
    <View style={styles.activityContent}>
      <Text style={styles.activityText}>
        <Text style={styles.activityName}>{item.user.name}</Text>
        {' '}{item.action} in{' '}
        <Text style={styles.activityChallenge}>{item.challenge}</Text>
      </Text>
      <Text style={styles.activityTime}>{item.time}</Text>
    </View>
  </View>
);

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { address, balanceUsdc, isConnected } = useWallet();
  const [refreshing, setRefreshing] = useState(false);

  const { challenges: activeChallenges, loading: activLoading, refresh: refreshActive } =
    useChallenges({ status: 'active', userId: user?.id, limit: 10 });

  const { challenges: endingSoon, refresh: refreshEndingSoon } =
    useChallenges({ status: 'active', limit: 5 });

  const endingSoonFiltered = endingSoon.filter((c) => {
    const hoursLeft = (new Date(c.ends_at).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursLeft <= 24;
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshActive(), refreshEndingSoon()]);
    setRefreshing(false);
  }, [refreshActive, refreshEndingSoon]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROTOCOL</Text>
        {isConnected && address ? (
          <WalletBadge
            address={address}
            balance={balanceUsdc}
            compact
          />
        ) : (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.connectButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>
            Good {getTimeOfDay()},{' '}
            <Text style={styles.greetingName}>
              {profile?.username ?? 'athlete'}
            </Text>{' '}
            👋
          </Text>
          <Text style={styles.greetingSubtext}>
            {activeChallenges.length > 0
              ? `${activeChallenges.length} active challenge${activeChallenges.length !== 1 ? 's' : ''}`
              : 'No active challenges — start one!'}
          </Text>
        </View>

        {/* My Active Challenges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Active Challenges</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.sectionAction}>See All</Text>
            </TouchableOpacity>
          </View>

          {activeChallenges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTitle}>No Active Challenges</Text>
              <Text style={styles.emptySubtext}>
                Join a challenge and start earning USDC
              </Text>
              <TouchableOpacity
                style={styles.emptyAction}
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
                <ChallengeCard
                  challenge={item}
                  showProgress
                  userProgress={0}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ width: theme.spacing.md }} />}
            />
          )}
        </View>

        {/* Ending Soon */}
        {endingSoonFiltered.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.urgentLabel}>
                <View style={styles.urgentDot} />
                <Text style={styles.sectionTitle}>Ending Soon</Text>
              </View>
            </View>
            {endingSoonFiltered.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                compact
                style={styles.compactCard}
              />
            ))}
          </View>
        )}

        {/* Friends Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Friends Activity</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>Follow More</Text>
            </TouchableOpacity>
          </View>

          {FRIENDS_ACTIVITY.map((item) => (
            <FriendActivityItem key={item.id} item={item} />
          ))}
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

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
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
  headerTitle: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  connectButton: {
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}40`,
  },
  connectButtonText: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  greeting: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
  },
  greetingText: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  greetingName: {
    color: theme.colors.accent,
  },
  greetingSubtext: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: theme.spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  sectionAction: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.accent,
  },
  horizontalList: {
    paddingHorizontal: theme.spacing.xl,
  },
  emptyCard: {
    marginHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    padding: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: theme.spacing.sm,
  },
  emptyActionText: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  urgentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  urgentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.loss,
  },
  compactCard: {
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  activityAvatarWrap: {
    position: 'relative',
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  activityPillarDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  activityName: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  activityChallenge: {
    color: theme.colors.accent,
  },
  activityTime: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.accent,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 34,
  },
});
