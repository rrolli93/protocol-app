/**
 * useContract.ts
 * Wagmi-based hooks for interacting with ProtocolEscrow.sol on Base.
 *
 * NOTE: Contract address is 0x000... (not yet deployed).
 * All on-chain writes will gracefully fail and surface user-friendly errors.
 */
import { useState, useCallback } from 'react';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi';
import { parseUnits, formatUnits, stringToHex, padHex } from 'viem';
import {
  PROTOCOL_ESCROW_ADDRESS,
  USDC_BASE_ADDRESS,
  PROTOCOL_ESCROW_ABI,
  ERC20_MINIMAL_ABI,
  BASE_CHAIN_ID,
} from '../lib/contracts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Supabase UUID string → bytes32 (padded hex) */
function uuidToBytes32(uuid: string): `0x${string}` {
  const hex = uuid.replace(/-/g, '');
  return padHex(`0x${hex}`, { size: 32 });
}

/** USDC has 6 decimals on Base */
const USDC_DECIMALS = 6;

function formatUsdcError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err);
  if (msg.includes('User rejected') || msg.includes('user rejected')) {
    return 'Transaction cancelled.';
  }
  if (msg.includes('0x000000') || msg.includes('zero address')) {
    return 'Contract not yet deployed on Base. Coming soon!';
  }
  if (msg.includes('insufficient funds')) {
    return 'Insufficient ETH for gas fees.';
  }
  if (msg.includes('USDC transfer failed') || msg.includes('ERC20')) {
    return 'USDC transfer failed. Check your balance and approval.';
  }
  return 'Transaction failed. Please try again.';
}

// ─── useWalletBalance ─────────────────────────────────────────────────────────

interface WalletBalanceResult {
  balance: bigint;
  formatted: string;
  isLoading: boolean;
}

export function useWalletBalance(): WalletBalanceResult {
  const { address, isConnected } = useAccount();

  const { data: rawBalance, isLoading } = useReadContract({
    address: USDC_BASE_ADDRESS,
    abi: ERC20_MINIMAL_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: BASE_CHAIN_ID,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 15_000,
    },
  });

  const balance = (rawBalance as bigint | undefined) ?? 0n;
  const formatted = formatUnits(balance, USDC_DECIMALS);

  return { balance, formatted, isLoading };
}

// ─── useCreateChallengeOnChain ────────────────────────────────────────────────

interface CreateChallengeOnChainArgs {
  challengeId: string;   // Supabase UUID
  stakeAmountUsdc: number; // e.g. 10 (dollars)
  durationDays: number;
}

interface WriteResult {
  write: (args: CreateChallengeOnChainArgs) => Promise<void>;
  isLoading: boolean;
  isSuccess: boolean;
  txHash: `0x${string}` | undefined;
  error: string | null;
}

export function useCreateChallengeOnChain(): WriteResult {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  const { writeContractAsync: approveUsdc } = useWriteContract();
  const { writeContractAsync: createChallenge } = useWriteContract();

  const write = useCallback(async (args: CreateChallengeOnChainArgs) => {
    if (!address) {
      setError('Wallet not connected.');
      return;
    }

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
    setTxHash(undefined);

    try {
      const stakeAmountBigInt = parseUnits(
        String(args.stakeAmountUsdc),
        USDC_DECIMALS
      );

      // Step 1: Approve USDC spend
      await approveUsdc({
        address: USDC_BASE_ADDRESS,
        abi: ERC20_MINIMAL_ABI,
        functionName: 'approve',
        args: [PROTOCOL_ESCROW_ADDRESS, stakeAmountBigInt],
        chainId: BASE_CHAIN_ID,
      });

      // Step 2: Calculate endsAt timestamp
      const endsAt = BigInt(
        Math.floor(Date.now() / 1000) + args.durationDays * 86400
      );

      // Step 3: Create challenge on-chain
      const hash = await createChallenge({
        address: PROTOCOL_ESCROW_ADDRESS,
        abi: PROTOCOL_ESCROW_ABI,
        functionName: 'createChallenge',
        args: [
          uuidToBytes32(args.challengeId),
          stakeAmountBigInt,
          endsAt,
          address, // creator as initial oracle
        ],
        chainId: BASE_CHAIN_ID,
      });

      setTxHash(hash);
      setIsSuccess(true);
    } catch (err) {
      setError(formatUsdcError(err));
    } finally {
      setIsLoading(false);
    }
  }, [address, approveUsdc, createChallenge]);

  return { write, isLoading, isSuccess, txHash, error };
}

// ─── useJoinChallengeOnChain ──────────────────────────────────────────────────

interface JoinChallengeOnChainArgs {
  stakeAmountUsdc: number;
}

interface JoinResult {
  write: (args: JoinChallengeOnChainArgs) => Promise<void>;
  isLoading: boolean;
  isSuccess: boolean;
  txHash: `0x${string}` | undefined;
  error: string | null;
}

export function useJoinChallengeOnChain(challengeId: string): JoinResult {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  const { writeContractAsync: approveUsdc } = useWriteContract();
  const { writeContractAsync: deposit } = useWriteContract();

  const write = useCallback(async (args: JoinChallengeOnChainArgs) => {
    if (!address) {
      setError('Wallet not connected.');
      return;
    }
    if (!challengeId) {
      setError('Invalid challenge ID.');
      return;
    }

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
    setTxHash(undefined);

    try {
      const stakeAmountBigInt = parseUnits(
        String(args.stakeAmountUsdc),
        USDC_DECIMALS
      );

      // Step 1: Approve USDC
      await approveUsdc({
        address: USDC_BASE_ADDRESS,
        abi: ERC20_MINIMAL_ABI,
        functionName: 'approve',
        args: [PROTOCOL_ESCROW_ADDRESS, stakeAmountBigInt],
        chainId: BASE_CHAIN_ID,
      });

      // Step 2: Deposit (joinChallenge equivalent — uses deposit() in the contract)
      const hash = await deposit({
        address: PROTOCOL_ESCROW_ADDRESS,
        abi: PROTOCOL_ESCROW_ABI,
        functionName: 'deposit',
        args: [uuidToBytes32(challengeId)],
        chainId: BASE_CHAIN_ID,
      });

      setTxHash(hash);
      setIsSuccess(true);
    } catch (err) {
      setError(formatUsdcError(err));
    } finally {
      setIsLoading(false);
    }
  }, [address, challengeId, approveUsdc, deposit]);

  return { write, isLoading, isSuccess, txHash, error };
}

// ─── useReadChallengeOnChain ──────────────────────────────────────────────────

export function useReadChallengeOnChain(challengeId: string | undefined) {
  const bytes32Id = challengeId ? uuidToBytes32(challengeId) : undefined;

  const { data, isLoading, error } = useReadContract({
    address: PROTOCOL_ESCROW_ADDRESS,
    abi: PROTOCOL_ESCROW_ABI,
    functionName: 'getChallenge',
    args: bytes32Id ? [bytes32Id] : undefined,
    chainId: BASE_CHAIN_ID,
    query: {
      enabled: !!bytes32Id,
    },
  });

  return { data, isLoading, error };
}
