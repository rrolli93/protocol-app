import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  supabase,
  Challenge,
  LeaderboardEntry,
  Profile,
  ChallengeParticipant,
} from '../lib/supabase';

interface UseChallengeState {
  challenge: Challenge | null;
  leaderboard: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
  loading: boolean;
  error: Error | null;
}

interface UseChallengeActions {
  refresh: () => Promise<void>;
  submitProgress: (progress: number) => Promise<void>;
}

export type UseChallengeReturn = UseChallengeState & UseChallengeActions;

export function useChallenge(
  challengeId: string,
  currentUserId?: string
): UseChallengeReturn {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const buildLeaderboard = useCallback(
    (
      participants: (ChallengeParticipant & { profiles: Profile })[],
      target: number
    ): LeaderboardEntry[] => {
      return participants
        .sort((a, b) => b.progress - a.progress)
        .map((p, index) => ({
          rank: index + 1,
          user: p.profiles,
          progress: p.progress,
          target,
          stake: p.stake_usdc,
          completed: p.completed,
        }));
    },
    []
  );

  const fetchChallenge = useCallback(async () => {
    if (!challengeId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: challengeData, error: challengeError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (challengeError) throw challengeError;

      setChallenge(challengeData);

      const { data: participantsData, error: participantsError } = await supabase
        .from('challenge_participants')
        .select(`
          *,
          profiles (*)
        `)
        .eq('challenge_id', challengeId)
        .order('progress', { ascending: false });

      if (participantsError) throw participantsError;

      const entries = buildLeaderboard(
        participantsData as (ChallengeParticipant & { profiles: Profile })[],
        challengeData.goal
      );

      setLeaderboard(entries);

      if (currentUserId) {
        const mine = entries.find((e) => e.user.id === currentUserId) ?? null;
        setMyEntry(mine);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [challengeId, currentUserId, buildLeaderboard]);

  const subscribeToRealtime = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`challenge:${challengeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenge_participants',
          filter: `challenge_id=eq.${challengeId}`,
        },
        async () => {
          await fetchChallenge();
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
        async (payload) => {
          setChallenge((prev) =>
            prev ? { ...prev, ...(payload.new as Challenge) } : null
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[useChallenge] Subscribed to challenge ${challengeId}`);
        }
      });

    channelRef.current = channel;
  }, [challengeId, fetchChallenge]);

  useEffect(() => {
    fetchChallenge();
    subscribeToRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchChallenge, subscribeToRealtime]);

  const submitProgress = useCallback(
    async (progress: number) => {
      if (!challengeId || !currentUserId) return;

      const { error: updateError } = await supabase
        .from('challenge_participants')
        .update({
          progress,
          updated_at: new Date().toISOString(),
        })
        .eq('challenge_id', challengeId)
        .eq('user_id', currentUserId);

      if (updateError) throw updateError;
    },
    [challengeId, currentUserId]
  );

  return {
    challenge,
    leaderboard,
    myEntry,
    loading,
    error,
    refresh: fetchChallenge,
    submitProgress,
  };
}

// Hook for fetching multiple challenges (home feed, explore)
export function useChallenges(options?: {
  pillarId?: string;
  status?: 'active' | 'completed';
  limit?: number;
  userId?: string;
}) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });

      if (options?.pillarId) {
        query = query.eq('pillar_id', options.pillarId);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.userId) {
        const { data: participantData } = await supabase
          .from('challenge_participants')
          .select('challenge_id')
          .eq('user_id', options.userId);

        const ids = (participantData ?? []).map((p) => p.challenge_id);
        if (ids.length > 0) {
          query = query.in('id', ids);
        }
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setChallenges(data ?? []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options?.pillarId, options?.status, options?.limit, options?.userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { challenges, loading, error, refresh: fetch };
}
