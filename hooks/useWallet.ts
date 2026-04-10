import { useState, useEffect, useCallback } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { formatUnits } from 'viem';
import { USDC_ADDRESSES, ERC20_ABI } from '../lib/wagmi';
import { base } from 'wagmi/chains';
import { BASE_CHAIN_ID } from '../lib/contracts';

interface WalletState {
  // Aliased as both `address` (legacy) and `walletAddress` for clarity
  address: `0x${string}` | undefined;
  walletAddress: `0x${string}` | undefined;
  balanceUsdc: number;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | undefined;
  error: Error | null;
}

interface WalletActions {
  connect: () => Promise<void>;
  connectWallet: () => Promise<void>;     // alias, used by WalletConnect component
  disconnect: () => void;
  disconnectWallet: () => void;           // alias
  switchToBase: () => Promise<void>;
  formatAddress: (addr: string) => string;
}

export type UseWalletReturn = WalletState & WalletActions;

export function useWallet(): UseWalletReturn {
  const { address, isConnected } = useAccount();
  const { connect: wagmiConnect, isPending: isConnecting } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const [error, setError] = useState<Error | null>(null);

  const usdcAddress =
    chainId && chainId in USDC_ADDRESSES
      ? USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES]
      : USDC_ADDRESSES[base.id];

  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 15_000,
    },
  });

  const balanceUsdc = rawBalance
    ? parseFloat(formatUnits(rawBalance as bigint, 6))
    : 0;

  // ── connectWallet ────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setError(null);
    try {
      wagmiConnect({
        connector: coinbaseWallet({
          appName: 'Protocol',
          preference: 'smartWalletOnly',
        }),
      });
    } catch (err) {
      setError(err as Error);
    }
  }, [wagmiConnect]);

  // ── disconnectWallet ─────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setError(null);
  }, [wagmiDisconnect]);

  // ── switchToBase ─────────────────────────────────────────────────────────────
  const switchToBase = useCallback(async () => {
    setError(null);
    try {
      await switchChain({ chainId: BASE_CHAIN_ID });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [switchChain]);

  const formatAddress = useCallback((addr: string): string => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      refetchBalance();
    }
  }, [isConnected, address, refetchBalance]);

  return {
    // State
    address,
    walletAddress: address,
    balanceUsdc,
    isConnected,
    isConnecting,
    chainId,
    error,
    // Actions
    connect,
    connectWallet: connect,
    disconnect,
    disconnectWallet: disconnect,
    switchToBase,
    formatAddress,
  };
}
