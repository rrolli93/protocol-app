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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { ChallengeCard } from '../../components/ChallengeCard';
import { useChallenges } from '../../hooks/useChallenge';
import { PILLARS } from '../../constants/pillars';

const FILTER_ALL = 'all';

const FILTERS = [
  { id: FILTER_ALL, label: 'ALL' },
  ...PILLARS.slice(0, 7).map((p) => ({ id: p.id, label: p.name })),
];

export default function ExploreScreen() {
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState(FILTER_ALL);
  const [refreshing, setRefreshing] = useState(false);

  const { challenges, loading, refresh } = useChallenges({
    status: 'active',
    pillarId: activeFilter !== FILTER_ALL ? activeFilter : undefined,
    limit: 50,
  });

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

  const handleFilterPress = useCallback((filterId: string) => {
    setActiveFilter(filterId);
    setSearchText('');
  }, []);

  const pillar = PILLARS.find((p) => p.id === activeFilter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSubtitle}>
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
            placeholderTextColor={theme.colors.textMuted}
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
        style={styles.filtersScrollView}
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const filterPillar = PILLARS.find((p) => p.id === filter.id);
          return (
            <TouchableOpacity
              key={filter.id}
              onPress={() => handleFilterPress(filter.id)}
              activeOpacity={0.75}
              style={[
                styles.filterPill,
                isActive && styles.filterPillActive,
                isActive && filterPillar && { borderColor: filterPillar.color, backgroundColor: filterPillar.accentColor },
              ]}
            >
              {filterPillar && (
                <Text style={styles.filterEmoji}>{filterPillar.icon}</Text>
              )}
              <Text
                style={[
                  styles.filterLabel,
                  isActive && styles.filterLabelActive,
                  isActive && filterPillar && { color: filterPillar.color },
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active filter banner */}
      {activeFilter !== FILTER_ALL && pillar && (
        <View style={[styles.filterBanner, { backgroundColor: pillar.accentColor }]}>
          <Text style={[styles.filterBannerIcon]}>{pillar.icon}</Text>
          <Text style={[styles.filterBannerText, { color: pillar.color }]}>
            {pillar.name} — {pillar.description}
          </Text>
          <TouchableOpacity onPress={() => setActiveFilter(FILTER_ALL)}>
            <Text style={[styles.filterBannerClear, { color: pillar.color }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Grid */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading challenges...</Text>
        </View>
      ) : filteredChallenges.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>
            {activeFilter !== FILTER_ALL ? pillar?.icon ?? '🔍' : '🔍'}
          </Text>
          <Text style={styles.emptyTitle}>No challenges found</Text>
          <Text style={styles.emptySubtext}>
            {searchText ? `No results for "${searchText}"` : 'Be the first to create one!'}
          </Text>
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
              tintColor={theme.colors.accent}
            />
          }
          renderItem={({ item }) => (
            <ChallengeCard
              challenge={item}
              style={styles.gridCard}
            />
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  clearIcon: {
    fontSize: 14,
    color: theme.colors.textMuted,
    padding: 4,
  },
  filtersScrollView: {
    maxHeight: 48,
    marginBottom: theme.spacing.md,
  },
  filtersRow: {
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterPillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  filterEmoji: {
    fontSize: 12,
  },
  filterLabel: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  filterLabelActive: {
    color: theme.colors.accent,
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  filterBannerIcon: {
    fontSize: 16,
  },
  filterBannerText: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '500',
  },
  filterBannerClear: {
    fontSize: 14,
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  emptySubtext: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  grid: {
    paddingHorizontal: theme.spacing.lg,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  gridCard: {
    width: '48%',
  },
});
