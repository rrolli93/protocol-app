import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  supabase,
  Challenge,
  LeaderboardEntry,
  Profile,
  ChallengeParticipant,
} from '../lib/supabase';

// ─── Pillar emoji map ─────────────────────────────────────────────────────────
export const PILLAR_EMOJI: Record<string, string> = {
  run: '🏃',
  fast: '⚡',
  sleep: '🌙',
  meditate: '🧘',
  cycle: '🚴',
  walk: '🚶',
  hrv: '💓',
  readiness: '⚡',
};

export function getPillarEmoji(pillarId: string): string {
  return PILLAR_EMOJI[pillarId] ?? '🏆';
}

// ─── Mock fallback data ────────────────────────────────────────────────────────
const MOCK_CHALLENGES: Challenge[] = [
  {
    id: 'mock-1',
    creator_id: 'mock-user',
    name: '30-Day Run Challenge',
    pillar_id: 'run',
    goal: 100,
    duration_days: 30,
    stake_usdc: 25,
    privacy: 'public',
    contract_address: null,
    total_pot_usdc: 250,
    participant_count: 10,
    starts_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 23 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    status: 'active',
  },
  {
    id: 'mock-2',
    creator_id: 'mock-user',
    name: 'Weekly Fast Protocol',
    pillar_id: 'fast',
    goal: 112,
    duration_days: 14,
    stake_usdc: 10,
    privacy: 'public',
    contract_address: null,
    total_pot_usdc: 80,
    participant_count: 8,
    starts_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 11 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    status: 'active',
  },
  {
    id: 'mock-3',
    creator_id: 'mock-user',
    name: 'Optimal Sleep Protocol',
    pillar_id: 'sleep',
    goal: 85,
    duration_days: 30,
    stake_usdc: 50,
    privacy: 'public',
    contract_address: null,
    total_pot_usdc: 500,
    participant_count: 12,
    starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 25 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    status: 'active',
  },
];

// ─── Query Keys ────────────────────────────────────────────────────────────────
export const challengeKeys = {
  all: ['challenges'] as const,
  userActive: (userId: string) => ['challenges', 'user', userId, 'active'] as const,
  public: (filter?: string) => ['challenges', 'public', filter ?? 'all'] as const,
  detail: (id: string) => ['challenges', 'detail', id] as const,
  participants: (id: string) => ['challenges', id, 'participants'] as const,
};

// ─── useChallenges — user's active challenges ─────────────────────────────────
export function useChallenges(userId?: string) {
  const query = useQuery({
    queryKey: challengeKeys.userActive(userId ?? ''),
    enabled: !!userId,
    queryFn: async (): Promise<Challenge[]> => {
      // Step 1: get challenge IDs where user participates
      const { data: participantData, error: pErr } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', userId!);

      if (pErr) throw pErr;

      const ids = (participantData ?? []).map((p) => p.challenge_id);
      if (ids.length === 0) return MOCK_CHALLENGES.slice(0, 2);

      // Step 2: fetch those challenges
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .in('id', ids)
        .eq('status', 'active')
        .order('ends_at', { ascending: true });

      if (error) throw error;
      const results = data ?? [];
      return results.length > 0 ? results : MOCK_CHALLENGES.slice(0, 2);
    },
    staleTime: 60_000,
  });

  return {
    challenges: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
    isRefetching: query.isRefetching,
  };
}

// ─── usePublicChallenges — explore feed ──────────────────────────────────────
export function usePublicChallenges(pillarFilter?: string) {
  const query = useQuery({
    queryKey: challengeKeys.public(pillarFilter),
    queryFn: async (): Promise<Challenge[]> => {
      let q = supabase
        .from('challenges')
        .select('*')
        .eq('privacy', 'public')
        .eq('status', 'active')
        .order('participant_count', { ascending: false })
        .limit(50);

      if (pillarFilter && pillarFilter !== 'all') {
        q = q.eq('pillar_id', pillarFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      const results = data ?? [];
      return results.length > 0 ? results : MOCK_CHALLENGES;
    },
    staleTime: 60_000,
  });

  return {
    challenges: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refresh: query.refetch,
    isRefetching: query.isRefetching,
  };
}

// ─── useChallenge — single challenge + participants ───────────────────────────
interface ChallengeDetail {
  challenge: Challenge | null;
  leaderboard: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
}

function buildLeaderboard(
  participants: (ChallengeParticipant & { profiles: Profile })[],
  target: number,
  currentUserId?: string
): { entries: LeaderboardEntry[]; myEntry: LeaderboardEntry | null } {
  const entries = [...participants]
    .sort((a, b) => b.progress - a.progress)
    .map((p, idx) => ({
      rank: idx + 1,
      user: p.profiles,
      progress: p.progress,
      target,
      stake: p.stake_usdc,
      completed: p.completed,
    }));

  const myEntry = currentUserId
    ? (entries.find((e) => e.user?.id === currentUserId) ?? null)
    : null;

  return { entries, myEntry };
}

export function useChallenge(challengeId: string, currentUserId?: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const query = useQuery({
    queryKey: [...challengeKeys.detail(challengeId), currentUserId],
    enabled: !!challengeId,
    queryFn: async (): Promise<ChallengeDetail> => {
      const { data: challengeData, error: challengeError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (challengeError) throw challengeError;

      const { data: participantsData, error: participantsError } = await supabase
        .from('challenge_participants')
        .select('*, profiles(*)')
        .eq('challenge_id', challengeId)
        .order('progress', { ascending: false });

      if (participantsError) throw participantsError;

      const { entries, myEntry } = buildLeaderboard(
        (participantsData ?? []) as (ChallengeParticipant & { profiles: Profile })[],
        challengeData.goal,
        currentUserId
      );

      return { challenge: challengeData, leaderboard: entries, myEntry };
    },
    staleTime: 30_000,
  });

  // Real-time subscription
  useEffect(() => {
    if (!challengeId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`challenge-detail:${challengeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenge_participants',
          filter: `challenge_id=eq.${challengeId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: challengeKeys.detail(challengeId),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenges',
          filter: `id=eq.${challengeId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: challengeKeys.detail(challengeId),
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [challengeId, queryClient]);

  const submitProgress = useCallback(
    async (progress: number) => {
      if (!challengeId || !currentUserId) return;
      const { error } = await supabase
        .from('challenge_participants')
        .update({ progress, updated_at: new Date().toISOString() })
        .eq('challenge_id', challengeId)
        .eq('user_id', currentUserId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: challengeKeys.detail(challengeId) });
    },
    [challengeId, currentUserId, queryClient]
  );

  return {
    challenge: query.data?.challenge ?? null,
    leaderboard: query.data?.leaderboard ?? [],
    myEntry: query.data?.myEntry ?? null,
    loading: query.isLoading,
    error: query.error as Error | null,
    refresh: query.refetch,
    submitProgress,
  };
}

// ─── useCreateChallenge ────────────────────────────────────────────────────────
interface CreateChallengeInput {
  creator_id: string;
  name: string;
  pillar_id: string;
  goal: number;
  duration_days: number;
  stake_usdc: number;
  privacy: 'public' | 'friends' | 'private';
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: CreateChallengeInput): Promise<Challenge> => {
      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + input.duration_days);

      const { data, error } = await supabase
        .from('challenges')
        .insert({
          creator_id: input.creator_id,
          name: input.name,
          pillar_id: input.pillar_id,
          goal: input.goal,
          duration_days: input.duration_days,
          stake_usdc: input.stake_usdc,
          privacy: input.privacy,
          total_pot_usdc: input.stake_usdc,
          participant_count: 1,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join creator
      const { error: joinError } = await supabase
        .from('challenge_participants')
        .insert({
          challenge_id: data.id,
          user_id: input.creator_id,
          progress: 0,
          stake_usdc: input.stake_usdc,
          completed: false,
          rank: 1,
        });

      if (joinError) throw joinError;

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: challengeKeys.all });
    },
  });

  return mutation;
}

// ─── useJoinChallenge ─────────────────────────────────────────────────────────
interface JoinChallengeInput {
  challenge_id: string;
  user_id: string;
  stake_usdc: number;
}

export function useJoinChallenge() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: JoinChallengeInput) => {
      // Insert participant
      const { error: joinError } = await supabase
        .from('challenge_participants')
        .insert({
          challenge_id: input.challenge_id,
          user_id: input.user_id,
          progress: 0,
          stake_usdc: input.stake_usdc,
          completed: false,
        });

      if (joinError) throw joinError;

      // Update challenge pot + participant count
      const { data: current, error: fetchErr } = await supabase
        .from('challenges')
        .select('total_pot_usdc, participant_count')
        .eq('id', input.challenge_id)
        .single();

      if (!fetchErr && current) {
        await supabase
          .from('challenges')
          .update({
            total_pot_usdc: (current.total_pot_usdc ?? 0) + input.stake_usdc,
            participant_count: (current.participant_count ?? 0) + 1,
          })
          .eq('id', input.challenge_id);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: challengeKeys.detail(variables.challenge_id) });
      queryClient.invalidateQueries({ queryKey: challengeKeys.all });
    },
  });

  return mutation;
}
