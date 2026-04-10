import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../constants/theme';
import { getPillarById } from '../constants/pillars';
import { Challenge } from '../lib/supabase';
import { PillarIcon } from './PillarIcon';

interface ChallengeCardProps {
  challenge: Challenge;
  showProgress?: boolean;
  userProgress?: number;
  style?: ViewStyle;
  compact?: boolean;
}

const ProgressRing: React.FC<{
  progress: number;
  size: number;
  color: string;
}> = ({ progress, size, color }) => {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: `${color}30`,
          position: 'absolute',
        }}
      />
      <View
        style={{
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          borderRadius: (size - strokeWidth * 2) / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderLeftColor: 'transparent',
          borderBottomColor:
            clampedProgress < 0.75 ? 'transparent' : color,
          transform: [{ rotate: `${clampedProgress * 360}deg` }],
          position: 'absolute',
        }}
      />
      <Text
        style={{
          fontFamily: theme.typography.fontFamily.mono,
          fontSize: theme.typography.fontSize.xs,
          color: color,
          fontWeight: theme.typography.fontWeight.bold,
        }}
      >
        {Math.round(clampedProgress * 100)}%
      </Text>
    </View>
  );
};

const getDaysRemaining = (endsAt: string): number => {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  showProgress = false,
  userProgress = 0,
  style,
  compact = false,
}) => {
  const router = useRouter();
  const pillar = getPillarById(challenge.pillar_id);
  const daysRemaining = getDaysRemaining(challenge.ends_at);
  const isEndingSoon = daysRemaining <= 1;
  const progress = showProgress ? userProgress / challenge.goal : 0;

  const handlePress = useCallback(() => {
    router.push(`/challenge/${challenge.id}`);
  }, [challenge.id, router]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[
        styles.card,
        compact && styles.cardCompact,
        style,
      ]}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <PillarIcon pillarId={challenge.pillar_id} size={compact ? 'sm' : 'md'} />
        <View style={styles.topRight}>
          {challenge.stake_usdc > 0 ? (
            <View style={styles.stakeBadge}>
              <Text style={styles.stakeBadgeText}>
                ${challenge.stake_usdc} USDC
              </Text>
            </View>
          ) : (
            <View style={[styles.stakeBadge, styles.stakeBadgeFree]}>
              <Text style={[styles.stakeBadgeText, styles.stakeBadgeTextFree]}>
                Free
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Challenge name */}
      <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
        {challenge.name}
      </Text>

      {/* Pillar label */}
      {pillar && (
        <Text style={[styles.pillarLabel, { color: pillar.color }]}>
          {pillar.name} · {pillar.unit.toUpperCase()}
        </Text>
      )}

      {/* Progress ring + meta */}
      <View style={styles.bottomRow}>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaValue}>{challenge.participant_count}</Text>
            <Text style={styles.metaLabel}>players</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaItem}>
            <Text style={[styles.metaValue, isEndingSoon && styles.urgentText]}>
              {daysRemaining}d
            </Text>
            <Text style={styles.metaLabel}>left</Text>
          </View>
          {challenge.total_pot_usdc > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.metaItem}>
                <Text style={[styles.metaValue, styles.potText]}>
                  ${challenge.total_pot_usdc}
                </Text>
                <Text style={styles.metaLabel}>pot</Text>
              </View>
            </>
          )}
        </View>

        {showProgress && (
          <ProgressRing
            progress={progress}
            size={48}
            color={pillar?.color ?? theme.colors.accent}
          />
        )}
      </View>

      {/* Ending soon indicator */}
      {isEndingSoon && daysRemaining > 0 && (
        <View style={styles.urgentBanner}>
          <Text style={styles.urgentBannerText}>⚡ Ending in {daysRemaining === 0 ? 'hours' : '24h'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    width: 220,
    ...theme.shadows.card,
  },
  cardCompact: {
    width: '100%',
    padding: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  topRight: {
    alignItems: 'flex-end',
  },
  stakeBadge: {
    backgroundColor: theme.colors.winMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.win}40`,
  },
  stakeBadgeFree: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  stakeBadgeText: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.win,
    fontWeight: theme.typography.fontWeight.bold,
  },
  stakeBadgeTextFree: {
    color: theme.colors.textMuted,
  },
  name: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.semibold,
    lineHeight: 20,
  },
  nameCompact: {
    fontSize: theme.typography.fontSize.md,
  },
  pillarLabel: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    letterSpacing: 0.5,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  metaLabel: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: theme.colors.border,
  },
  urgentText: {
    color: theme.colors.loss,
  },
  potText: {
    color: theme.colors.win,
  },
  urgentBanner: {
    backgroundColor: `${theme.colors.loss}15`,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: `${theme.colors.loss}30`,
  },
  urgentBannerText: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.loss,
    fontWeight: theme.typography.fontWeight.medium,
  },
});
