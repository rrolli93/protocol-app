import { useState, useEffect, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useReadContract, useChainId } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { formatUnits } from 'viem';
import { USDC_ADDRESSES, ERC20_ABI } from '../lib/wagmi';
import { base } from 'wagmi/chains';

interface WalletState {
  address: `0x${string}` | undefined;
  balanceUsdc: number;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | undefined;
  error: Error | null;
}

interface WalletActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  formatAddress: (addr: string) => string;
}

export type UseWalletReturn = WalletState & WalletActions;

export function useWallet(): UseWalletReturn {
  const { address, isConnected } = useAccount();
  const { connect: wagmiConnect, isPending: isConnecting } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
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

  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setError(null);
  }, [wagmiDisconnect]);

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
    address,
    balanceUsdc,
    isConnected,
    isConnecting,
    chainId,
    error,
    connect,
    disconnect,
    formatAddress,
  };
}
