-- ============================================================
-- PROTOCOL Fitness Challenge App — Supabase Migration
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────
CREATE TYPE integration_provider AS ENUM ('strava', 'oura', 'whoop', 'healthkit');
CREATE TYPE activity_source      AS ENUM ('strava', 'oura', 'whoop', 'healthkit', 'manual');
CREATE TYPE challenge_pillar     AS ENUM ('run', 'cycle', 'walk', 'sleep', 'fast', 'meditate', 'hrv', 'readiness');
CREATE TYPE challenge_status     AS ENUM ('draft', 'active', 'completed', 'cancelled');
CREATE TYPE invite_status        AS ENUM ('pending', 'accepted', 'declined', 'expired');
CREATE TYPE meditation_source    AS ENUM ('healthkit', 'manual');

-- ─── Helper: updated_at trigger function ─────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            TEXT        UNIQUE NOT NULL,
  display_name        TEXT,
  avatar_url          TEXT,
  wallet_address      TEXT,
  strava_connected    BOOLEAN     NOT NULL DEFAULT FALSE,
  oura_connected      BOOLEAN     NOT NULL DEFAULT FALSE,
  whoop_connected     BOOLEAN     NOT NULL DEFAULT FALSE,
  healthkit_connected BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username        ON users (username);
CREATE INDEX idx_users_wallet_address  ON users (wallet_address);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: user_integrations
-- ============================================================
CREATE TABLE IF NOT EXISTS user_integrations (
  id               UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         integration_provider NOT NULL,
  -- tokens stored encrypted via pgcrypto; app layer calls pgp_sym_encrypt/decrypt
  access_token     TEXT                NOT NULL,
  refresh_token    TEXT,
  expires_at       TIMESTAMPTZ,
  scope            TEXT,
  provider_user_id TEXT,
  created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX idx_user_integrations_user_id  ON user_integrations (user_id);
CREATE INDEX idx_user_integrations_provider ON user_integrations (provider);

CREATE TRIGGER trg_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: challenges
-- ============================================================
CREATE TABLE IF NOT EXISTS challenges (
  id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id       UUID             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title            TEXT             NOT NULL,
  description      TEXT,
  pillar           challenge_pillar NOT NULL,
  goal_value       NUMERIC          NOT NULL,
  goal_unit        TEXT             NOT NULL,
  duration_days    INT              NOT NULL,
  starts_at        TIMESTAMPTZ      NOT NULL,
  ends_at          TIMESTAMPTZ      NOT NULL,
  stake_per_user   NUMERIC          NOT NULL DEFAULT 0,
  contract_address TEXT,
  is_public        BOOLEAN          NOT NULL DEFAULT TRUE,
  status           challenge_status NOT NULL DEFAULT 'draft',
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_dates CHECK (ends_at > starts_at),
  CONSTRAINT chk_goal   CHECK (goal_value > 0),
  CONSTRAINT chk_stake  CHECK (stake_per_user >= 0)
);

-- For expiry / cron jobs scanning active challenges
CREATE INDEX idx_challenges_status_ends_at ON challenges (status, ends_at);
CREATE INDEX idx_challenges_creator_id     ON challenges (creator_id);
CREATE INDEX idx_challenges_pillar         ON challenges (pillar);
CREATE INDEX idx_challenges_is_public      ON challenges (is_public) WHERE is_public = TRUE;

CREATE TRIGGER trg_challenges_updated_at
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: challenge_participants
-- ============================================================
CREATE TABLE IF NOT EXISTS challenge_participants (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id        UUID        NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stake_tx_hash       TEXT,
  current_score       NUMERIC     NOT NULL DEFAULT 0,
  completed           BOOLEAN     NOT NULL DEFAULT FALSE,
  completion_tx_hash  TEXT,
  rank                INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_cp_challenge_id ON challenge_participants (challenge_id);
CREATE INDEX idx_cp_user_id      ON challenge_participants (user_id);
CREATE INDEX idx_cp_rank         ON challenge_participants (challenge_id, rank);

CREATE TRIGGER trg_challenge_participants_updated_at
  BEFORE UPDATE ON challenge_participants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: activities
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id          UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      activity_source  NOT NULL,
  external_id TEXT,
  pillar      challenge_pillar NOT NULL,
  value       NUMERIC          NOT NULL,
  unit        TEXT             NOT NULL,
  recorded_at TIMESTAMPTZ      NOT NULL,
  raw_data    JSONB,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_activities_user_id     ON activities (user_id);
CREATE INDEX idx_activities_pillar      ON activities (pillar);
CREATE INDEX idx_activities_recorded_at ON activities (user_id, recorded_at DESC);
CREATE INDEX idx_activities_source_ext  ON activities (source, external_id);
-- GIN index for raw_data queries
CREATE INDEX idx_activities_raw_data    ON activities USING GIN (raw_data);

-- ============================================================
-- TABLE: fasting_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS fasting_sessions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at     TIMESTAMPTZ NOT NULL,
  ended_at       TIMESTAMPTZ,             -- NULL = fast in progress
  duration_hours NUMERIC     GENERATED ALWAYS AS (
    CASE
      WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600.0
      ELSE NULL
    END
  ) STORED,
  target_hours   NUMERIC     NOT NULL DEFAULT 16,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fast_dates CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX idx_fasting_user_id     ON fasting_sessions (user_id);
CREATE INDEX idx_fasting_started_at  ON fasting_sessions (user_id, started_at DESC);
-- Active fasts (no end time yet)
CREATE INDEX idx_fasting_active      ON fasting_sessions (user_id) WHERE ended_at IS NULL;

-- ============================================================
-- TABLE: meditation_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS meditation_sessions (
  id               UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ       NOT NULL,
  ended_at         TIMESTAMPTZ       NOT NULL,
  duration_minutes NUMERIC           NOT NULL,
  source           meditation_source NOT NULL DEFAULT 'manual',
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_meditation_dates    CHECK (ended_at > started_at),
  CONSTRAINT chk_meditation_duration CHECK (duration_minutes > 0)
);

CREATE INDEX idx_meditation_user_id    ON meditation_sessions (user_id);
CREATE INDEX idx_meditation_started_at ON meditation_sessions (user_id, started_at DESC);

-- ============================================================
-- TABLE: push_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token  TEXT        NOT NULL,
  device_id        TEXT        NOT NULL,
  platform         TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX idx_push_user_id ON push_subscriptions (user_id);

-- ============================================================
-- TABLE: challenge_invites
-- ============================================================
CREATE TABLE IF NOT EXISTS challenge_invites (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id  UUID          NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  invited_by    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code   TEXT          UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  invitee_email TEXT,
  status        invite_status NOT NULL DEFAULT 'pending',
  expires_at    TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invites_challenge_id ON challenge_invites (challenge_id);
CREATE INDEX idx_invites_invited_by   ON challenge_invites (invited_by);
CREATE INDEX idx_invites_invite_code  ON challenge_invites (invite_code);
CREATE INDEX idx_invites_status       ON challenge_invites (status, expires_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fasting_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meditation_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_invites      ENABLE ROW LEVEL SECURITY;

-- ── users ────────────────────────────────────────────────────
CREATE POLICY "users: read own"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users: insert own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users: update own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public profiles are readable by anyone (for leaderboards)
CREATE POLICY "users: public profiles readable"
  ON users FOR SELECT
  USING (TRUE);

-- ── user_integrations ────────────────────────────────────────
CREATE POLICY "integrations: own only"
  ON user_integrations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── challenges ───────────────────────────────────────────────
CREATE POLICY "challenges: public readable"
  ON challenges FOR SELECT
  USING (
    is_public = TRUE
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM challenge_participants cp
      WHERE cp.challenge_id = challenges.id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "challenges: creator insert"
  ON challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "challenges: creator update"
  ON challenges FOR UPDATE
  USING (auth.uid() = creator_id);

-- ── challenge_participants ────────────────────────────────────
CREATE POLICY "participants: readable by challenge participants"
  ON challenge_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM challenge_participants cp2
      WHERE cp2.challenge_id = challenge_participants.challenge_id
        AND cp2.user_id = auth.uid()
    )
  );

CREATE POLICY "participants: join own"
  ON challenge_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "participants: update own"
  ON challenge_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- ── activities ───────────────────────────────────────────────
CREATE POLICY "activities: own only"
  ON activities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── fasting_sessions ─────────────────────────────────────────
CREATE POLICY "fasting: own only"
  ON fasting_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── meditation_sessions ──────────────────────────────────────
CREATE POLICY "meditation: own only"
  ON meditation_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── push_subscriptions ───────────────────────────────────────
CREATE POLICY "push: own only"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── challenge_invites ────────────────────────────────────────
CREATE POLICY "invites: sender or challenge participant can read"
  ON challenge_invites FOR SELECT
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM challenge_participants cp
      WHERE cp.challenge_id = challenge_invites.challenge_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "invites: participants can create"
  ON challenge_invites FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by
    AND EXISTS (
      SELECT 1 FROM challenge_participants cp
      WHERE cp.challenge_id = challenge_invites.challenge_id
        AND cp.user_id = auth.uid()
    )
  );

-- ============================================================
-- SCORING FUNCTION: update_challenge_scores(challenge_id)
-- Recalculates current_score and rank for all participants
-- based on matching activities within the challenge window.
-- ============================================================
CREATE OR REPLACE FUNCTION update_challenge_scores(p_challenge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pillar      challenge_pillar;
  v_starts_at   TIMESTAMPTZ;
  v_ends_at     TIMESTAMPTZ;
BEGIN
  -- Fetch challenge metadata
  SELECT pillar, starts_at, ends_at
  INTO v_pillar, v_starts_at, v_ends_at
  FROM challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % not found', p_challenge_id;
  END IF;

  -- Update current_score for each participant from matching activities
  UPDATE challenge_participants cp
  SET
    current_score = agg.total_value,
    updated_at    = NOW()
  FROM (
    SELECT
      a.user_id,
      COALESCE(SUM(a.value), 0) AS total_value
    FROM activities a
    INNER JOIN challenge_participants cp2
      ON cp2.user_id = a.user_id
     AND cp2.challenge_id = p_challenge_id
    WHERE a.pillar       = v_pillar
      AND a.recorded_at >= v_starts_at
      AND a.recorded_at <= v_ends_at
    GROUP BY a.user_id
  ) agg
  WHERE cp.challenge_id = p_challenge_id
    AND cp.user_id      = agg.user_id;

  -- Zero out participants who have no qualifying activities
  UPDATE challenge_participants
  SET current_score = 0,
      updated_at    = NOW()
  WHERE challenge_id  = p_challenge_id
    AND user_id NOT IN (
      SELECT DISTINCT a.user_id
      FROM activities a
      WHERE a.pillar       = v_pillar
        AND a.recorded_at >= v_starts_at
        AND a.recorded_at <= v_ends_at
    );

  -- Recalculate dense rank (highest score = rank 1)
  UPDATE challenge_participants cp
  SET rank       = ranked.new_rank,
      updated_at = NOW()
  FROM (
    SELECT
      id,
      DENSE_RANK() OVER (
        PARTITION BY challenge_id
        ORDER BY current_score DESC
      ) AS new_rank
    FROM challenge_participants
    WHERE challenge_id = p_challenge_id
  ) ranked
  WHERE cp.id = ranked.id;

END;
$$;

-- ============================================================
-- SEED DATA — 3 sample challenges
-- NOTE: These reference placeholder UUIDs. In a real migration
--       these would be linked to real auth.users entries.
-- ============================================================

DO $$
DECLARE
  user1_id UUID := '00000000-0000-0000-0000-000000000001';
  user2_id UUID := '00000000-0000-0000-0000-000000000002';
  user3_id UUID := '00000000-0000-0000-0000-000000000003';

  ch_run_id   UUID := uuid_generate_v4();
  ch_sleep_id UUID := uuid_generate_v4();
  ch_fast_id  UUID := uuid_generate_v4();
BEGIN

  -- ── Seed users (fake — must exist in auth.users first in production) ──
  INSERT INTO users (id, username, display_name, avatar_url, wallet_address,
                     strava_connected, oura_connected)
  VALUES
    (user1_id, 'alex_runs',   'Alex Runner',   'https://i.pravatar.cc/150?u=1', '0xABCDEF1234567890ABCDEF1234567890ABCDEF01', TRUE,  FALSE),
    (user2_id, 'sleep_queen', 'Morgan Sleep',  'https://i.pravatar.cc/150?u=2', '0xABCDEF1234567890ABCDEF1234567890ABCDEF02', FALSE, TRUE),
    (user3_id, 'fasting_pro', 'Jordan Fast',   'https://i.pravatar.cc/150?u=3', '0xABCDEF1234567890ABCDEF1234567890ABCDEF03', FALSE, FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- ── Challenge 1: 50 km Running Challenge ──────────────────
  INSERT INTO challenges (id, creator_id, title, description, pillar,
                          goal_value, goal_unit, duration_days,
                          starts_at, ends_at,
                          stake_per_user, is_public, status)
  VALUES (
    ch_run_id,
    user1_id,
    '50K Running Challenge',
    'Run 50 km over the next 7 days. Sync via Strava. Top finisher takes the pot.',
    'run',
    50, 'km', 7,
    NOW(),
    NOW() + INTERVAL '7 days',
    10.00,
    TRUE,
    'active'
  );

  INSERT INTO challenge_participants (challenge_id, user_id, joined_at, stake_tx_hash, current_score)
  VALUES
    (ch_run_id, user1_id, NOW(),                     '0xaaa111', 18.3),
    (ch_run_id, user2_id, NOW() + INTERVAL '2 hours','0xaaa222', 12.7),
    (ch_run_id, user3_id, NOW() + INTERVAL '4 hours','0xaaa333',  5.0);

  INSERT INTO activities (user_id, source, external_id, pillar, value, unit, recorded_at)
  VALUES
    (user1_id, 'strava', 'strava-run-001', 'run', 10.2, 'km', NOW() - INTERVAL '1 day'),
    (user1_id, 'strava', 'strava-run-002', 'run',  8.1, 'km', NOW() - INTERVAL '2 days'),
    (user2_id, 'strava', 'strava-run-003', 'run', 12.7, 'km', NOW() - INTERVAL '1 day'),
    (user3_id, 'manual', NULL,             'run',  5.0, 'km', NOW() - INTERVAL '3 days');

  -- ── Challenge 2: Sleep Quality Challenge ──────────────────
  INSERT INTO challenges (id, creator_id, title, description, pillar,
                          goal_value, goal_unit, duration_days,
                          starts_at, ends_at,
                          stake_per_user, is_public, status)
  VALUES (
    ch_sleep_id,
    user2_id,
    '7-Night Sleep Score Challenge',
    'Maintain an average sleep score of 85+ over 7 nights using Oura or Whoop.',
    'sleep',
    85, 'score', 7,
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '4 days',
    25.00,
    TRUE,
    'active'
  );

  INSERT INTO challenge_participants (challenge_id, user_id, joined_at, stake_tx_hash, current_score)
  VALUES
    (ch_sleep_id, user2_id, NOW() - INTERVAL '3 days', '0xbbb111', 88.4),
    (ch_sleep_id, user3_id, NOW() - INTERVAL '3 days', '0xbbb222', 74.1);

  INSERT INTO activities (user_id, source, external_id, pillar, value, unit, recorded_at)
  VALUES
    (user2_id, 'oura', 'oura-sleep-001', 'sleep', 91, 'score', NOW() - INTERVAL '1 day'),
    (user2_id, 'oura', 'oura-sleep-002', 'sleep', 85, 'score', NOW() - INTERVAL '2 days'),
    (user2_id, 'oura', 'oura-sleep-003', 'sleep', 89, 'score', NOW() - INTERVAL '3 days'),
    (user3_id, 'oura', 'oura-sleep-004', 'sleep', 72, 'score', NOW() - INTERVAL '1 day'),
    (user3_id, 'oura', 'oura-sleep-005', 'sleep', 76, 'score', NOW() - INTERVAL '2 days');

  -- ── Challenge 3: Intermittent Fasting Challenge ───────────
  INSERT INTO challenges (id, creator_id, title, description, pillar,
                          goal_value, goal_unit, duration_days,
                          starts_at, ends_at,
                          stake_per_user, is_public, status)
  VALUES (
    ch_fast_id,
    user3_id,
    '16:8 Fasting 5-Day Streak',
    'Complete five 16-hour fasts in a row. Log your fasting window each day.',
    'fast',
    16, 'hours', 5,
    NOW() - INTERVAL '2 days',
    NOW() + INTERVAL '3 days',
    5.00,
    TRUE,
    'active'
  );

  INSERT INTO challenge_participants (challenge_id, user_id, joined_at, stake_tx_hash, current_score)
  VALUES
    (ch_fast_id, user3_id, NOW() - INTERVAL '2 days', '0xccc111', 2),
    (ch_fast_id, user1_id, NOW() - INTERVAL '2 days', '0xccc222', 1);

  INSERT INTO fasting_sessions (user_id, started_at, ended_at, target_hours, notes)
  VALUES
    (user3_id, NOW() - INTERVAL '2 days 8 hours', NOW() - INTERVAL '1 day 16 hours', 16, 'Day 1 - clean fast'),
    (user3_id, NOW() - INTERVAL '1 day 8 hours',  NOW() - INTERVAL '16 hours',        16, 'Day 2 - felt great'),
    (user1_id, NOW() - INTERVAL '2 days 6 hours', NOW() - INTERVAL '1 day 14 hours', 16, 'Day 1 - tough but did it');

END $$;
