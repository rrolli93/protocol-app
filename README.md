# Protocol

**Run your protocol. Win their stack.**

Protocol is a native iOS fitness challenge app where athletes stake USDC on real health goals — running, cycling, sleep, fasting, meditation, HRV, and more. Smart contracts on Base hold the pot; winners split it automatically. No middlemen. No excuses.

---

## What is Protocol?

- **Create or join challenges** around 8 health pillars: Run, Cycle, Walk, Sleep, Fast, Meditate, HRV, Readiness
- **Stake USDC** on your ability to hit the goal — entry fees pool into a smart contract escrow on Base
- **Connect data sources** — Strava, Oura Ring, WHOOP, Apple Health — for automatic, tamper-proof progress tracking
- **Coinbase Smart Wallet** for signing: no seed phrase, Face ID authentication, seamless onboarding
- **Real-time leaderboards** powered by Supabase Realtime
- **Winners share the pot** — settled on-chain after the challenge ends

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | Expo 51 + React Native 0.74 |
| Routing | expo-router v3 (file-based) |
| Auth | Supabase Auth (Apple, Strava OAuth) |
| Database | Supabase (Postgres + Realtime) |
| Wallet | Coinbase Smart Wallet via wagmi v2 + viem v2 |
| Chain | Base (mainnet + Sepolia testnet) |
| Payment | USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| Health data | Apple HealthKit (react-native-health), Strava API, Oura API, WHOOP API |
| State management | TanStack Query v5 + React state |
| Storage | AsyncStorage (session), react-native-mmkv (cache) |
| Design | Dark mode, Inter UI font, JetBrains Mono numbers |

---

## Prerequisites

- Node.js 20+
- Xcode 15+ (for iOS simulator / device)
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- A Supabase project (free tier works)
- An Expo account (for EAS builds)

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/rrolli93/protocol-app.git
cd protocol-app
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

| Variable | Where to get it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `EXPO_PUBLIC_BASE_CONTRACT_ADDRESS` | After smart contract deployment (see below) |
| `EXPO_PUBLIC_USDC_ADDRESS` | Already set: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | [Strava API dashboard](https://www.strava.com/settings/api) |
| `OURA_CLIENT_ID` / `OURA_CLIENT_SECRET` | [Oura Developer Portal](https://cloud.ouraring.com/oauth/applications) |
| `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET` | [WHOOP Developer Portal](https://developer.whoop.com/) |

### 3. Set up Supabase database

Run these migrations in your Supabase SQL editor:

```sql
-- Profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text NOT NULL,
  handle text UNIQUE,
  avatar_url text,
  wallet_address text,
  strava_connected boolean DEFAULT false,
  oura_connected boolean DEFAULT false,
  whoop_connected boolean DEFAULT false,
  apple_health_connected boolean DEFAULT false,
  challenges_won integer DEFAULT 0,
  total_earned_usdc numeric DEFAULT 0,
  current_streak integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Challenges
CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) NOT NULL,
  name text NOT NULL,
  pillar_id text NOT NULL,
  goal numeric NOT NULL,
  duration_days integer NOT NULL,
  stake_usdc numeric DEFAULT 0,
  privacy text DEFAULT 'public' CHECK (privacy IN ('public', 'friends', 'private')),
  contract_address text,
  total_pot_usdc numeric DEFAULT 0,
  participant_count integer DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- Participants
CREATE TABLE challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES challenges(id) NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  progress numeric DEFAULT 0,
  stake_usdc numeric DEFAULT 0,
  rank integer,
  completed boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_participants;
```

### 4. Place font assets

Download and place fonts in `assets/fonts/`:

- `Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-Bold.ttf` — [Inter font](https://rsms.me/inter/)
- `JetBrainsMono-Regular.ttf`, `JetBrainsMono-Bold.ttf` — [JetBrains Mono](https://www.jetbrains.com/lp/mono/)

---

## Running Locally

```bash
# Start Expo dev server (opens in Expo Go or simulator)
npm start

# Run on iOS simulator
npm run ios

# Run on Android
npm run android
```

> **Note:** Apple HealthKit, Coinbase Smart Wallet, and push notifications require a real device build (not Expo Go). Use the EAS preview build below.

---

## Building for TestFlight with EAS

### 1. Configure EAS

```bash
eas init
```

Create `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "your-app-store-connect-id"
      }
    }
  }
}
```

### 2. Build for TestFlight (preview)

```bash
eas build --platform ios --profile preview
```

### 3. Submit to TestFlight

```bash
eas submit --platform ios
```

Or upload the `.ipa` manually via App Store Connect / Transporter.

### Required Apple Developer setup

- Enable **HealthKit** capability in your App ID (App Store Connect → Certificates, IDs & Profiles)
- Add your test devices to the ad-hoc provisioning profile for internal preview builds

---

## Smart Contract Deployment

The challenge escrow contract lives in `/contracts` (Solidity, Hardhat/Foundry).

### 1. Prerequisites

```bash
npm install -g foundry  # or hardhat
```

### 2. Deploy to Base Sepolia (testnet)

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

### 3. Deploy to Base Mainnet

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

### 4. Update env

Copy the deployed contract address to your `.env`:

```
EXPO_PUBLIC_BASE_CONTRACT_ADDRESS=0xYourDeployedAddress
```

And update `lib/wagmi.ts` `PROTOCOL_CONTRACTS` with the real addresses.

---

## Project Structure

```
protocol-app/
├── app/
│   ├── _layout.tsx          # Root layout, auth guard, providers
│   ├── (auth)/
│   │   └── login.tsx        # Coinbase Wallet + Apple / Strava sign-in
│   ├── (tabs)/
│   │   ├── index.tsx        # Home feed
│   │   ├── explore.tsx      # Discover challenges
│   │   ├── create.tsx       # Create a challenge
│   │   └── profile.tsx      # Profile, stats, connected sources
│   └── challenge/
│       └── [id].tsx         # Challenge detail + leaderboard
├── components/              # Shared UI components
├── constants/               # theme.ts, pillars.ts
├── hooks/                   # useAuth, useChallenge, useHealthKit, useWallet
├── lib/                     # supabase.ts, wagmi.ts, healthkit.ts
└── assets/
    └── fonts/               # Inter, JetBrains Mono
```

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional commits: `feat:`, `fix:`, `chore:`
4. Open a PR against `main`

---

## License

MIT — see [LICENSE](./LICENSE)
