import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { theme } from '../constants/theme';

interface StakeButtonProps {
  amount: number;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  style?: ViewStyle;
  variant?: 'primary' | 'outline' | 'ghost';
}

export const StakeButton: React.FC<StakeButtonProps> = ({
  amount,
  onPress,
  loading = false,
  disabled = false,
  label,
  style,
  variant = 'primary',
}) => {
  const isDisabled = disabled || loading;
  const buttonLabel = label ?? (amount > 0 ? `Stake $${amount} USDC` : 'Join Free');

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'outline' && styles.buttonOutline,
        variant === 'ghost' && styles.buttonGhost,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : theme.colors.accent}
        />
      ) : (
        <>
          {amount > 0 && (
            <Text
              style={[
                styles.currencySymbol,
                variant === 'outline' && styles.textOutline,
                variant === 'ghost' && styles.textGhost,
                isDisabled && styles.textDisabled,
              ]}
            >
              💎
            </Text>
          )}
          <Text
            style={[
              styles.label,
              variant === 'primary' && styles.labelPrimary,
              variant === 'outline' && styles.textOutline,
              variant === 'ghost' && styles.textGhost,
              isDisabled && styles.textDisabled,
            ]}
          >
            {buttonLabel}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    minHeight: 52,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accent,
    ...theme.shadows.accent,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  buttonGhost: {
    backgroundColor: theme.colors.accentMuted,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  currencySymbol: {
    fontSize: 16,
  },
  label: {
    fontFamily: 'Inter',
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    letterSpacing: 0.3,
  },
  labelPrimary: {
    color: '#FFFFFF',
  },
  textOutline: {
    color: theme.colors.accent,
  },
  textGhost: {
    color: theme.colors.accent,
  },
  textDisabled: {
    color: theme.colors.textMuted,
  },
});
