import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

const APP_NAME = 'Protocol';
const APP_LOGO_URL = 'https://protocol.app/icon.png';

// Wagmi config — Base + Base Sepolia chains, Coinbase Smart Wallet connector
// preference: 'smartWalletOnly' forces the Coinbase Smart Wallet UX (Face ID,
// no seed phrase, passkey-based) rather than the EOA mobile app.
export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: APP_LOGO_URL,
      // 'smartWalletOnly' — no seed phrase, Face ID / passkey signing
      preference: 'smartWalletOnly',
    }),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
});

// USDC contract addresses per chain
export const USDC_ADDRESSES = {
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
} as const;

// Protocol smart contract addresses — fill after deployment
export const PROTOCOL_CONTRACTS = {
  [base.id]: {
    challengeFactory: (process.env.EXPO_PUBLIC_BASE_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    challengeManager: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  [baseSepolia.id]: {
    challengeFactory: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    challengeManager: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
} as const;

// Minimal ERC-20 ABI for USDC read + approve operations
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Challenge escrow contract ABI
export const CHALLENGE_ABI = [
  {
    inputs: [
      { name: 'pillarId', type: 'string' },
      { name: 'goal', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' },
      { name: 'stakeAmount', type: 'uint256' },
    ],
    name: 'createChallenge',
    outputs: [{ name: 'challengeId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    name: 'joinChallenge',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'challengeId', type: 'bytes32' },
      { name: 'progress', type: 'uint256' },
      { name: 'proof', type: 'bytes' },
    ],
    name: 'submitProgress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    name: 'settle',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    name: 'getChallenge',
    outputs: [
      { name: 'pillarId', type: 'string' },
      { name: 'goal', type: 'uint256' },
      { name: 'endsAt', type: 'uint256' },
      { name: 'stakeAmount', type: 'uint256' },
      { name: 'totalPot', type: 'uint256' },
      { name: 'settled', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export { base, baseSepolia };
