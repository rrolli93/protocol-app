import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { theme } from '../constants/theme';
import { Profile } from '../lib/supabase';

interface LeaderboardRowProps {
  rank: number;
  user: Profile;
  progress: number;
  target: number;
  stake: number;
  isCurrentUser?: boolean;
  unit?: string;
}

const getRankEmoji = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
};

const getRankColor = (rank: number): string => {
  switch (rank) {
    case 1: return '#FFD700';
    case 2: return '#C0C0C0';
    case 3: return '#CD7F32';
    default: return theme.colors.textMuted;
  }
};

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  rank,
  user,
  progress,
  target,
  stake,
  isCurrentUser = false,
  unit = '',
}) => {
  const percentage = Math.min(100, (progress / target) * 100);
  const isTop3 = rank <= 3;
  const avatarInitials = (user.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <View
      style={[
        styles.row,
        isCurrentUser && styles.rowCurrentUser,
      ]}
    >
      {/* Current user indicator */}
      {isCurrentUser && <View style={styles.currentUserBorder} />}

      {/* Rank */}
      <View style={styles.rankContainer}>
        {isTop3 ? (
          <Text style={styles.rankEmoji}>{getRankEmoji(rank)}</Text>
        ) : (
          <Text style={[styles.rankNumber, { color: getRankColor(rank) }]}>
            {rank}
          </Text>
        )}
      </View>

      {/* Avatar */}
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitials}>{avatarInitials}</Text>
        </View>
      )}

      {/* Name + progress */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isCurrentUser && styles.nameCurrentUser]}>
            {user.username}
            {isCurrentUser && (
              <Text style={styles.youLabel}> (you)</Text>
            )}
          </Text>
          <Text style={styles.progressValue}>
            <Text style={styles.progressNumber}>{progress}</Text>
            {unit && <Text style={styles.progressUnit}> {unit}</Text>}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${percentage}%` as any,
                backgroundColor: isCurrentUser
                  ? theme.colors.accent
                  : percentage >= 100
                  ? theme.colors.win
                  : theme.colors.textMuted,
              },
            ]}
          />
        </View>
      </View>

      {/* Stake */}
      {stake > 0 && (
        <View style={styles.stakeContainer}>
          <Text style={styles.stakeAmount}>${stake}</Text>
          <Text style={styles.stakeLabel}>USDC</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowCurrentUser: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: `${theme.colors.accent}40`,
  },
  currentUserBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.colors.accent,
    borderTopLeftRadius: theme.borderRadius.md,
    borderBottomLeftRadius: theme.borderRadius.md,
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 18,
  },
  rankNumber: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarInitials: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  info: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  nameCurrentUser: {
    color: theme.colors.accent,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  youLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.regular,
  },
  progressValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  progressNumber: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  progressUnit: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  stakeContainer: {
    alignItems: 'center',
  },
  stakeAmount: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.win,
    fontWeight: theme.typography.fontWeight.bold,
  },
  stakeLabel: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: 9,
    color: theme.colors.textMuted,
  },
});
