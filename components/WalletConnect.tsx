/**
 * WalletConnect.tsx
 * Reusable component shown when the user's wallet is not connected.
 * Shows Coinbase Wallet branding and a connect button.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useWallet } from '../hooks/useWallet';

// ─── Design tokens (matches app palette) ────────────────────────────────────
const C = {
  bg: '#0A0A0F',
  card: '#0D0D1A',
  border: '#1A1A2E',
  primary: '#6C63FF',
  primaryMuted: 'rgba(108,99,255,0.12)',
  textPrimary: '#FFFFFF',
  textSecondary: '#8888AA',
  baseBlue: '#0052FF',
  baseBlueMuted: 'rgba(0,82,255,0.12)',
};

// ─── Coinbase/Base icon (SVG-free: a styled blue square with "C") ────────────
const CoinbaseIcon: React.FC = () => (
  <View style={styles.cbIconContainer}>
    <Text style={styles.cbIconText}>C</Text>
  </View>
);

// ─── Props ───────────────────────────────────────────────────────────────────
interface WalletConnectProps {
  /** Optional title shown above the card */
  title?: string;
  /** Optional subtitle / reason to connect */
  subtitle?: string;
  /** Called after a successful connection attempt (wallet may still be pending) */
  onConnected?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export const WalletConnect: React.FC<WalletConnectProps> = ({
  title = 'Connect your wallet',
  subtitle = 'You need a wallet to stake USDC and join challenges.',
  onConnected,
}) => {
  const { connectWallet, isConnecting, error, isConnected, walletAddress, formatAddress } =
    useWallet();

  const handleConnect = async () => {
    await connectWallet();
    if (onConnected) onConnected();
  };

  // If already connected, show a compact connected pill instead
  if (isConnected && walletAddress) {
    return (
      <View style={styles.connectedPill}>
        <View style={styles.connectedDot} />
        <Text style={styles.connectedText}>
          {formatAddress(walletAddress)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Icon */}
      <CoinbaseIcon />

      {/* Text */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error.message.includes('User rejected') || error.message.includes('user rejected')
              ? 'Connection cancelled.'
              : error.message}
          </Text>
        </View>
      )}

      {/* Connect button */}
      <TouchableOpacity
        style={[styles.connectBtn, isConnecting && styles.connectBtnDisabled]}
        onPress={handleConnect}
        disabled={isConnecting}
        activeOpacity={0.85}
      >
        {isConnecting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.connectBtnText}>Connect Wallet</Text>
        )}
      </TouchableOpacity>

      {/* Powered by Base */}
      <View style={styles.poweredRow}>
        <View style={styles.baseDot} />
        <Text style={styles.poweredText}>Powered by Base</Text>
      </View>
    </View>
  );
};

export default WalletConnect;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  cbIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.baseBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cbIconText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: C.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: 'rgba(255,71,87,0.12)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.3)',
    width: '100%',
  },
  errorText: {
    color: '#FF4757',
    fontSize: 12,
    textAlign: 'center',
  },
  connectBtn: {
    backgroundColor: C.baseBlue,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 4,
  },
  connectBtnDisabled: {
    opacity: 0.6,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  poweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  baseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.baseBlue,
  },
  poweredText: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '500',
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.baseBlueMuted,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${C.baseBlue}40`,
  },
  connectedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00FF87',
  },
  connectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textPrimary,
  },
});
