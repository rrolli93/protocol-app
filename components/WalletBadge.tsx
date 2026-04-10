import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../constants/theme';

interface WalletBadgeProps {
  address: string;
  balance: number;
  style?: ViewStyle;
  compact?: boolean;
  showCopy?: boolean;
  onPress?: () => void;
}

const truncateAddress = (addr: string): string => {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const formatBalance = (balance: number): string => {
  if (balance >= 1000) {
    return `$${(balance / 1000).toFixed(1)}k`;
  }
  return `$${balance.toFixed(2)}`;
};

export const WalletBadge: React.FC<WalletBadgeProps> = ({
  address,
  balance,
  style,
  compact = false,
  showCopy = true,
  onPress,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress ?? handleCopy}
        activeOpacity={0.75}
        style={[styles.compactBadge, style]}
      >
        <View style={styles.dot} />
        <Text style={styles.compactBalance}>
          {formatBalance(balance)} USDC
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.addressRow}>
        <View style={styles.addressChip}>
          <Text style={styles.addressIcon}>⬡</Text>
          <Text style={styles.address}>{truncateAddress(address)}</Text>
        </View>
        {showCopy && (
          <TouchableOpacity
            onPress={handleCopy}
            activeOpacity={0.7}
            style={styles.copyButton}
          >
            <Text style={styles.copyIcon}>{copied ? '✓' : '⎘'}</Text>
            <Text style={[styles.copyLabel, copied && styles.copiedLabel]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceLeft}>
          <View style={styles.usdcDot} />
          <Text style={styles.balanceAmount}>{formatBalance(balance)}</Text>
          <Text style={styles.balanceCurrency}>USDC</Text>
        </View>
        <Text style={styles.networkLabel}>Base</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  addressIcon: {
    fontSize: 12,
    color: theme.colors.usdc,
  },
  address: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accentMuted,
  },
  copyIcon: {
    fontSize: 12,
    color: theme.colors.accent,
  },
  copyLabel: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.accent,
    fontWeight: theme.typography.fontWeight.medium,
  },
  copiedLabel: {
    color: theme.colors.win,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  usdcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2775CA',
  },
  balanceAmount: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.xxl,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  balanceCurrency: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  networkLabel: {
    fontFamily: theme.typography.fontFamily.ui,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.accent,
    fontWeight: theme.typography.fontWeight.medium,
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}30`,
  },
  // compact variant
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.win,
  },
  compactBalance: {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
