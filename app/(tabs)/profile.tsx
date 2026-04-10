import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useChallenges, getPillarEmoji } from '../../hooks/useChallenge';
import { Challenge } from '../../lib/supabase';
import { useStravaConnect } from '../../hooks/useStrava';

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

// ─── Sub-components ───────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: string | number;
  color?: string;
}> = ({ label, value, color = C.textPrimary }) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const IntegrationRow: React.FC<{
  icon: string;
  label: string;
  sublabel: string;
  connected?: boolean;
  loading?: boolean;
  onPress: () => void;
}> = ({ icon, label, sublabel, connected, loading, onPress }) => (
  <TouchableOpacity
    style={styles.integrationRow}
    onPress={onPress}
    activeOpacity={0.75}
    disabled={loading}
  >
    <View style={styles.integrationIconWrap}>
      <Text style={styles.integrationIcon}>{icon}</Text>
    </View>
    <View style={styles.integrationInfo}>
      <Text style={styles.integrationLabel}>{label}</Text>
      <Text
        style={[
          styles.integrationSublabel,
          connected && { color: C.success },
        ]}
      >
        {sublabel}
      </Text>
    </View>
    <View
      style={[
        styles.integrationBadge,
        connected ? styles.integrationBadgeConnected : styles.integrationBadgeIdle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={C.primary} />
      ) : (
        <Text
          style={[
            styles.integrationBadgeText,
            connected && { color: C.success },
          ]}
        >
          {connected ? 'Connected ✓' : 'Connect'}
        </Text>
      )}
    </View>
  </TouchableOpacity>
);

const ActiveChallengeRow: React.FC<{
  item: Challenge;
  onPress: () => void;
}> = ({ item, onPress }) => {
  const emoji = getPillarEmoji(item.pillar_id);
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(item.ends_at).getTime() - Date.now()) / 86400000)
  );

  return (
    <TouchableOpacity style={styles.challengeRow} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.challengeEmoji}>{emoji}</Text>
      <View style={styles.challengeInfo}>
        <Text style={styles.challengeName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.challengeMeta}>
          {daysLeft}d remaining
          {item.total_pot_usdc > 0 ? ` · $${item.total_pot_usdc} pot` : ''}
        </Text>
      </View>
      <Text style={styles.challengeArrow}>›</Text>
    </TouchableOpacity>
  );
};

// ─── Profile Screen ───────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const { challenges: activeChallenges, loading: challengesLoading } = useChallenges(user?.id);

  // Strava OAuth hook
  const {
    connect: connectStrava,
    loading: stravaConnecting,
    error: stravaError,
    connected: stravaHookConnected,
  } = useStravaConnect(user?.id);

  const username =
    profile?.username ?? user?.email?.split('@')[0] ?? 'athlete';
  const displayName = profile?.handle
    ? `@${profile.handle}`
    : user?.email ?? '';
  const initials = username.slice(0, 2).toUpperCase();
  const walletAddress = profile?.wallet_address ?? null;

  const totalWon = profile?.challenges_won ?? 0;
  const totalEarned = profile?.total_earned_usdc ?? 0;
  const streak = profile?.current_streak ?? 0;

  // stravaConnected is true if either the profile says so or the hook just connected
  const stravaConnected = (profile?.strava_connected ?? false) || stravaHookConnected;
  const appleConnected = profile?.apple_health_connected ?? false;

  // Show Strava error as an alert (non-blocking)
  React.useEffect(() => {
    if (stravaError) {
      Alert.alert('Strava Connect Error', stravaError);
    }
  }, [stravaError]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            router.replace('/(auth)/welcome');
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Could not sign out.');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }, [signOut, router]);

  const handleIntegrationPress = (label: string) => {
    Alert.alert(`${label} Integration`, 'Integration coming soon in a future update!');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => Alert.alert('Settings', 'Settings screen coming soon.')}
          activeOpacity={0.7}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Avatar + Identity ───────────────────────────────────────────── */}
        <View style={styles.identitySection}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <View style={styles.avatarGlow} />
          </View>

          <Text style={styles.username}>{username}</Text>
          {displayName ? (
            <Text style={styles.displayName}>{displayName}</Text>
          ) : null}

          {walletAddress ? (
            <View style={styles.walletRow}>
              <Text style={styles.walletIcon}>⬡</Text>
              <Text style={styles.walletAddress}>
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectWalletBtn}
              onPress={() => Alert.alert('Wallet', 'Wallet connection coming soon.')}
            >
              <Text style={styles.connectWalletText}>⬡ Connect Wallet</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Stats Row ────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard label="Won" value={totalWon} color={C.success} />
          <View style={styles.statDivider} />
          <StatCard
            label="Earned"
            value={`$${totalEarned.toFixed(0)}`}
            color={C.success}
          />
          <View style={styles.statDivider} />
          <StatCard label="Streak" value={`${streak}d`} color={C.primary} />
        </View>

        {/* ── Integrations ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integrations</Text>
          <View style={styles.sectionCard}>
            <IntegrationRow
              icon="🏃"
              label="Strava"
              sublabel={stravaConnected ? 'Syncing activities' : 'Track runs & rides'}
              connected={stravaConnected}
              loading={stravaConnecting}
              onPress={stravaConnected ? () => {} : connectStrava}
            />
            <View style={styles.rowDivider} />
            <IntegrationRow
              icon="❤️"
              label="Apple Health"
              sublabel={appleConnected ? 'Connected' : 'Sleep, steps & more'}
              connected={appleConnected}
              onPress={() => handleIntegrationPress('Apple Health')}
            />
            <View style={styles.rowDivider} />
            <IntegrationRow
              icon="⬡"
              label="Wallet Address"
              sublabel={
                walletAddress
                  ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
                  : 'Not connected'
              }
              connected={!!walletAddress}
              onPress={() => handleIntegrationPress('Wallet')}
            />
          </View>
        </View>

        {/* ── Active Challenges ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Challenges</Text>

          {challengesLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.primary} />
            </View>
          ) : activeChallenges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyText}>No active challenges</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/explore')}
                style={styles.exploreBtn}
              >
                <Text style={styles.exploreBtnText}>Explore →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sectionCard}>
              {activeChallenges.map((item, idx) => (
                <View key={item.id}>
                  <ActiveChallengeRow
                    item={item}
                    onPress={() => router.push(`/challenge/${item.id}`)}
                  />
                  {idx < activeChallenges.length - 1 && (
                    <View style={styles.rowDivider} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Sign Out ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.75}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator color={C.error} />
            ) : (
              <Text style={styles.signOutText}>Sign Out</Text>
            )}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 1,
  },
  settingsBtn: {
    padding: 6,
  },
  settingsIcon: {
    fontSize: 22,
  },
  scroll: {
    flex: 1,
  },
  identitySection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.primaryMuted,
    borderWidth: 2,
    borderColor: `${C.primary}60`,
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
    backgroundColor: C.primary,
    opacity: 0.08,
    zIndex: 0,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '700',
    color: C.primary,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  displayName: {
    fontSize: 13,
    color: C.textSecondary,
    letterSpacing: 0.3,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    marginTop: 2,
  },
  walletIcon: {
    fontSize: 14,
    color: C.primary,
  },
  walletAddress: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
  },
  connectWalletBtn: {
    backgroundColor: C.primaryMuted,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: `${C.primary}40`,
    marginTop: 2,
  },
  connectWalletText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.primary,
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
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    gap: 3,
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
    marginHorizontal: 20,
    marginBottom: 28,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  rowDivider: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 16,
  },
  // Integrations
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  integrationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrationIcon: {
    fontSize: 18,
  },
  integrationInfo: {
    flex: 1,
  },
  integrationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
  },
  integrationSublabel: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  integrationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  integrationBadgeConnected: {
    backgroundColor: `${C.success}12`,
    borderColor: `${C.success}40`,
  },
  integrationBadgeIdle: {
    backgroundColor: C.primaryMuted,
    borderColor: `${C.primary}40`,
  },
  integrationBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
  },
  // Active challenges
  loadingBox: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
  },
  exploreBtn: {
    marginTop: 4,
  },
  exploreBtnText: {
    fontSize: 13,
    color: C.primary,
    fontWeight: '600',
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  challengeEmoji: {
    fontSize: 24,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
  },
  challengeMeta: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  challengeArrow: {
    fontSize: 20,
    color: C.textSecondary,
  },
  // Sign out
  signOutBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: `${C.error}40`,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.error,
  },
});
