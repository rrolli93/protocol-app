import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePublicChallenges, useJoinChallenge, getPillarEmoji } from '../../hooks/useChallenge';
import { useAuth } from '../../hooks/useAuth';
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

// ─── Pillar filter options ────────────────────────────────────────────────────
const PILLAR_FILTERS = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'run', label: 'Run', emoji: '🏃' },
  { id: 'fast', label: 'Fast', emoji: '⚡' },
  { id: 'sleep', label: 'Sleep', emoji: '🌙' },
  { id: 'meditate', label: 'Meditate', emoji: '🧘' },
  { id: 'cycle', label: 'Cycle', emoji: '🚴' },
  { id: 'walk', label: 'Walk', emoji: '🚶' },
];

// ─── Challenge Grid Card ──────────────────────────────────────────────────────
interface GridCardProps {
  item: Challenge;
  userId?: string;
  onJoin: (challenge: Challenge) => void;
  onPress: () => void;
  joining: boolean;
}

const GridCard: React.FC<GridCardProps> = ({ item, onJoin, onPress, joining }) => {
  const emoji = getPillarEmoji(item.pillar_id);

  return (
    <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.gridEmoji}>{emoji}</Text>
      <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>

      <View style={styles.gridMeta}>
        <Text style={styles.gridMetaText}>👥 {item.participant_count}</Text>
        {item.total_pot_usdc > 0 ? (
          <Text style={[styles.gridMetaText, { color: C.success }]}>
            ${item.total_pot_usdc}
          </Text>
        ) : (
          <Text style={styles.gridMetaText}>Free</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.joinBtn, joining && styles.joinBtnLoading]}
        onPress={() => onJoin(item)}
        activeOpacity={0.75}
        disabled={joining}
      >
        {joining ? (
          <ActivityIndicator size="small" color={C.primary} />
        ) : (
          <Text style={styles.joinBtnText}>Join</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

// ─── Explore Screen ──────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const filter = activeFilter !== 'all' ? activeFilter : undefined;
  const { challenges, loading, refresh, isRefetching } = usePublicChallenges(filter);
  const joinMutation = useJoinChallenge();

  const filteredChallenges = useMemo(() => {
    if (!searchText.trim()) return challenges;
    const q = searchText.toLowerCase();
    return challenges.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.pillar_id.toLowerCase().includes(q)
    );
  }, [challenges, searchText]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleJoin = useCallback(
    async (challenge: Challenge) => {
      if (!user?.id) {
        Alert.alert('Sign In Required', 'Please sign in to join a challenge.');
        return;
      }
      setJoiningId(challenge.id);
      try {
        await joinMutation.mutateAsync({
          challenge_id: challenge.id,
          user_id: user.id,
          stake_usdc: challenge.stake_usdc,
        });
        Alert.alert('Joined! 🎉', `You've joined "${challenge.name}". Good luck!`);
        router.push(`/challenge/${challenge.id}`);
      } catch (err: any) {
        Alert.alert('Could not join', err?.message ?? 'Try again.');
      } finally {
        setJoiningId(null);
      }
    },
    [user?.id, joinMutation, router]
  );

  const renderCard = useCallback(
    ({ item }: { item: Challenge }) => (
      <GridCard
        item={item}
        userId={user?.id}
        onJoin={handleJoin}
        onPress={() => router.push(`/challenge/${item.id}`)}
        joining={joiningId === item.id}
      />
    ),
    [user?.id, handleJoin, joiningId, router]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <Text style={styles.headerCount}>
          {filteredChallenges.length} challenge{filteredChallenges.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search challenges..."
            placeholderTextColor={C.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={styles.filtersScroll}
      >
        {PILLAR_FILTERS.map((f) => {
          const isActive = activeFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setActiveFilter(f.id)}
              activeOpacity={0.75}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
            >
              <Text style={styles.filterEmoji}>{f.emoji}</Text>
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Grid */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading challenges...</Text>
        </View>
      ) : filteredChallenges.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No challenges found</Text>
          <Text style={styles.emptySubtext}>
            {searchText
              ? `No results for "${searchText}"`
              : 'Be the first to create one!'}
          </Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/(tabs)/create')}
          >
            <Text style={styles.createBtnText}>+ Create Challenge</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredChallenges}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.primary}
            />
          }
          renderItem={renderCard}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: C.textPrimary,
  },
  headerCount: {
    fontSize: 13,
    color: C.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {
    fontSize: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.textPrimary,
    padding: 0,
  },
  clearIcon: {
    fontSize: 13,
    color: C.textSecondary,
    padding: 4,
  },
  filtersScroll: {
    maxHeight: 48,
    marginBottom: 12,
  },
  filtersRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterPillActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryMuted,
  },
  filterEmoji: {
    fontSize: 13,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },
  filterLabelActive: {
    color: C.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: C.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
  },
  emptySubtext: {
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
  },
  createBtn: {
    marginTop: 8,
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  grid: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    width: '48.5%',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 8,
  },
  gridEmoji: {
    fontSize: 30,
  },
  gridName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textPrimary,
    lineHeight: 18,
    minHeight: 36,
  },
  gridMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridMetaText: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '500',
  },
  joinBtn: {
    backgroundColor: C.primaryMuted,
    borderWidth: 1,
    borderColor: `${C.primary}50`,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  joinBtnLoading: {
    opacity: 0.6,
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.primary,
  },
});
