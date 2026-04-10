// ─── Contract Addresses ───────────────────────────────────────────────────────
// Placeholder address — replace with real address after deployment
export const PROTOCOL_ESCROW_ADDRESS =
  '0x0000000000000000000000000000000000000000' as `0x${string}`;

// Real USDC on Base mainnet
export const USDC_BASE_ADDRESS =
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;

// Chain IDs
export const BASE_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// ─── ProtocolEscrow ABI ───────────────────────────────────────────────────────
// Extracted from ProtocolEscrow.sol — key public/external functions only
export const PROTOCOL_ESCROW_ABI = [
  // createChallenge(bytes32 challengeId, uint256 stakeAmount, uint256 endsAt, address oracle)
  {
    inputs: [
      { name: 'challengeId', type: 'bytes32' },
      { name: 'stakeAmount',  type: 'uint256' },
      { name: 'endsAt',       type: 'uint256' },
      { name: 'oracle',       type: 'address' },
    ],
    name: 'createChallenge',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // deposit(bytes32 challengeId) — called by participant to stake USDC
  {
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // settleChallenge(bytes32 challengeId, address[] winners, address[] losers)
  {
    inputs: [
      { name: 'challengeId', type: 'bytes32' },
      { name: 'winners',     type: 'address[]' },
      { name: 'losers',      type: 'address[]' },
    ],
    name: 'settleChallenge',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // emergencyRefund(bytes32 challengeId) — owner-only
  {
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    name: 'emergencyRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // getChallenge(bytes32 challengeId) view
  {
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    name: 'getChallenge',
    outputs: [
      { name: 'stakeAmount',      type: 'uint256' },
      { name: 'endsAt',           type: 'uint256' },
      { name: 'oracle',           type: 'address' },
      { name: 'status',           type: 'uint8' },
      { name: 'totalDeposited',   type: 'uint256' },
      { name: 'participantCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // getParticipants(bytes32 challengeId) view
  {
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    name: 'getParticipants',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },

  // hasDeposited(bytes32 challengeId, address participant) view
  {
    inputs: [
      { name: 'challengeId', type: 'bytes32' },
      { name: 'participant', type: 'address' },
    ],
    name: 'hasDeposited',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ─── Events ─────────────────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: 'challengeId', type: 'bytes32' },
      { indexed: false, name: 'stakeAmount', type: 'uint256' },
      { indexed: false, name: 'endsAt',      type: 'uint256' },
      { indexed: true,  name: 'oracle',      type: 'address' },
    ],
    name: 'ChallengeCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: 'challengeId', type: 'bytes32' },
      { indexed: true,  name: 'participant', type: 'address' },
      { indexed: false, name: 'amount',      type: 'uint256' },
    ],
    name: 'Deposited',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  name: 'challengeId',  type: 'bytes32' },
      { indexed: false, name: 'winners',      type: 'address[]' },
      { indexed: false, name: 'winnerPayout', type: 'uint256' },
      { indexed: false, name: 'protocolFee',  type: 'uint256' },
      { indexed: false, name: 'protocolOwner', type: 'address' },
    ],
    name: 'Settled',
    type: 'event',
  },
] as const;

// ─── ERC-20 minimal ABI (approve + balanceOf) ─────────────────────────────────
export const ERC20_MINIMAL_ABI = [
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
      { name: 'amount',  type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ─── ChallengeStatus enum mirror ─────────────────────────────────────────────
export enum ChallengeStatus {
  Created  = 0,
  Active   = 1,
  Settled  = 2,
  Refunded = 3,
}
