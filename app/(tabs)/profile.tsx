import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Switch,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { WalletBadge } from '../../components/WalletBadge';
import { PillarIcon } from '../../components/PillarIcon';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConnectedSource {
  id: string;
  name: string;
  icon: string;
  color: string;
  field: 'strava_connected' | 'oura_connected' | 'whoop_connected' | 'apple_health_connected';
}

interface ChallengeHistoryItem {
  id: string;
  name: string;
  pillarId: string;
  result: 'WIN' | 'LOSS';
  earned: number;
  endedAt: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CONNECTED_SOURCES: ConnectedSource[] = [
  {
    id: 'strava',
    name: 'Strava',
    icon: '🏃',
    color: theme.colors.strava,
    field: 'strava_connected',
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    icon: '💍',
    color: theme.colors.oura,
    field: 'oura_connected',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    icon: '⌚',
    color: theme.colors.whoop,
    field: 'whoop_connected',
  },
  {
    id: 'apple',
    name: 'Apple Health',
    icon: '❤️',
    color: theme.colors.apple,
    field: 'apple_health_connected',
  },
];

// Mock challenge history — replace with real Supabase query
const MOCK_HISTORY: ChallengeHistoryItem[] = [
  {
    id: '1',
    name: '30-Day Run Challenge',
    pillarId: 'run',
    result: 'WIN',
    earned: 45.5,
    endedAt: '2024-03-01',
  },
  {
    id: '2',
    name: 'Sleep Score Protocol',
    pillarId: 'sleep',
    result: 'LOSS',
    earned: 0,
    endedAt: '2024-02-15',
  },
  {
    id: '3',
    name: '100K Steps Sprint',
    pillarId: 'walk',
    result: 'WIN',
    earned: 30,
    endedAt: '2024-01-28',
  },
  {
    id: '4',
    name: 'Weekly Fast Protocol',
    pillarId: 'fast',
    result: 'WIN',
    earned: 60,
    endedAt: '2024-01-10',
  },
  {
    id: '5',
    name: 'HRV Boost Challenge',
    pillarId: 'hrv',
    result: 'LOSS',
    earned: 0,
    endedAt: '2023-12-20',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  highlight?: string;
}> = ({ label, value, prefix, suffix, highlight }) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, highlight ? { color: highlight } : null]}>
      {prefix}
      {value}
      {suffix}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const SourceRow: React.FC<{
  source: ConnectedSource;
  enabled: boolean;
  onToggle: (id: string, value: boolean) => void;
}> = ({ source, enabled, onToggle }) => (
  <View style={styles.sourceRow}>
    <View style={[styles.sourceIconWrap, { backgroundColor: `${source.color}20` }]}>
      <Text style={styles.sourceIcon}>{source.icon}</Text>
    </View>
    <View style={styles.sourceInfo}>
      <Text style={styles.sourceName}>{source.name}</Text>
      <Text style={[styles.sourceStatus, { color: enabled ? theme.colors.win : theme.colors.textMuted }]}>
        {enabled ? 'Connected' : 'Not connected'}
      </Text>
    </View>
    <Switch
      value={enabled}
      onValueChange={(v) => onToggle(source.id, v)}
      trackColor={{
        false: theme.colors.border,
        true: `${theme.colors.accent}60`,
      }}
      thumbColor={enabled ? theme.colors.accent : theme.colors.textMuted}
      ios_backgroundColor={theme.colors.border}
    />
  </View>
);

const HistoryItem: React.FC<{ item: ChallengeHistoryItem }> = ({ item }) => {
  const isWin = item.result === 'WIN';
  return (
    <View style={styles.historyItem}>
      <PillarIcon pillarId={item.pillarId} size="sm" />
      <View style={styles.historyInfo}>
        <Text style={styles.historyName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.historyDate}>{formatDate(item.endedAt)}</Text>
      </View>
      <View style={styles.historyRight}>
        <View
          style={[
            styles.resultBadge,
            isWin ? styles.resultBadgeWin : styles.resultBadgeLoss,
          ]}
        >
          <Text
            style={[
              styles.resultBadgeText,
              isWin ? styles.resultWinText : styles.resultLossText,
            ]}
          >
            {item.result}
          </Text>
        </View>
        {isWin && item.earned > 0 && (
          <Text style={styles.earnedAmount}>+${item.earned.toFixed(0)}</Text>
        )}
      </View>
    </View>
  );
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { address, balanceUsdc, isConnected } = useWallet();

  const [sourceToggles, setSourceToggles] = useState({
    strava: profile?.strava_connected ?? false,
    oura: profile?.oura_connected ?? false,
    whoop: profile?.whoop_connected ?? false,
    apple: profile?.apple_health_connected ?? false,
  });

  const handleSourceToggle = useCallback(
    (id: string, value: boolean) => {
      setSourceToggles((prev) => ({ ...prev, [id]: value }));
      // TODO: persist to Supabase profiles table
    },
    []
  );

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  }, [signOut]);

  const username = profile?.username ?? user?.email?.split('@')[0] ?? 'athlete';
  const initials = username.slice(0, 2).toUpperCase();

  const totalWon = profile?.challenges_won ?? 0;
  const totalEarned = profile?.total_earned_usdc ?? 0;
  const streak = profile?.current_streak ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            // TODO: navigate to settings screen
            Alert.alert('Settings', 'Settings screen coming soon.');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + Identity */}
        <View style={styles.identitySection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <View style={styles.avatarGlow} />
          </View>

          <Text style={styles.username}>{username}</Text>
          {profile?.handle && (
            <Text style={styles.handle}>@{profile.handle}</Text>
          )}

          {isConnected && address ? (
            <WalletBadge
              address={address}
              balance={balanceUsdc}
              style={styles.walletBadge}
            />
          ) : (
            <TouchableOpacity
              style={styles.connectWalletCta}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.connectWalletCtaText}>⬡ Connect Wallet</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard label="Won" value={totalWon} highlight={theme.colors.win} />
          <View style={styles.statsDivider} />
          <StatCard
            label="Earned"
            value={totalEarned.toFixed(0)}
            prefix="$"
            suffix=" USDC"
            highlight={theme.colors.win}
          />
          <View style={styles.statsDivider} />
          <StatCard label="Streak" value={streak} suffix="d" highlight={theme.colors.accent} />
        </View>

        {/* Connected Sources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Sources</Text>
          <View style={styles.sectionCard}>
            {CONNECTED_SOURCES.map((source, idx) => (
              <View key={source.id}>
                <SourceRow
                  source={source}
                  enabled={sourceToggles[source.id as keyof typeof sourceToggles]}
                  onToggle={handleSourceToggle}
                />
                {idx < CONNECTED_SOURCES.length - 1 && (
                  <View style={styles.rowDivider} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Challenge History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Challenge History</Text>
          {MOCK_HISTORY.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryIcon}>📜</Text>
              <Text style={styles.emptyHistoryText}>No completed challenges yet.</Text>
              <Text style={styles.emptyHistorySubtext}>
                Join a challenge and write your history.
              </Text>
            </View>
          ) : (
            <View style={styles.sectionCard}>
              {MOCK_HISTORY.map((item, idx) => (
                <View key={item.id}>
                  <HistoryItem item={item} />
                  {idx < MOCK_HISTORY.length - 1 && (
                    <View style={styles.rowDivider} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

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
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  settingsButton: {
    padding: theme.spacing.sm,
  },
  settingsIcon: {
    fontSize: 22,
  },
  scroll: {
    flex: 1,
  },
  // Identity
  identitySection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 2,
    borderColor: `${theme.colors.accent}60`,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  avatarGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.accent,
    opacity: 0.08,
    zIndex: 0,
  },
  avatarInitials: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.accent,
  },
  username: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },
  handle: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  walletBadge: {
    width: '100%',
    marginTop: theme.spacing.sm,
  },
  connectWalletCta: {
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}40`,
    marginTop: theme.spacing.sm,
  },
  connectWalletCtaText: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.accent,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    gap: 4,
  },
  statValue: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  // Sections
  section: {
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    letterSpacing: 0.3,
  },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  rowDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.xl + 44, // indent past icon
  },
  // Connected Sources
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  sourceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIcon: {
    fontSize: 20,
  },
  sourceInfo: {
    flex: 1,
    gap: 2,
  },
  sourceName: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  sourceStatus: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  // Challenge History
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  historyInfo: {
    flex: 1,
    gap: 3,
  },
  historyName: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  historyDate: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  resultBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  resultBadgeWin: {
    backgroundColor: theme.colors.winMuted,
    borderColor: `${theme.colors.win}40`,
  },
  resultBadgeLoss: {
    backgroundColor: theme.colors.lossMuted,
    borderColor: `${theme.colors.loss}40`,
  },
  resultBadgeText: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  resultWinText: {
    color: theme.colors.win,
  },
  resultLossText: {
    color: theme.colors.loss,
  },
  earnedAmount: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.win,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  // Empty state
  emptyHistory: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    padding: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyHistoryIcon: {
    fontSize: 32,
  },
  emptyHistoryText: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  emptyHistorySubtext: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  // Sign Out
  signOutButton: {
    backgroundColor: theme.colors.lossMuted,
    borderWidth: 1,
    borderColor: `${theme.colors.loss}30`,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.loss,
  },
});
