import { useState, useEffect, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import {
  buildStravaAuthUrl,
  exchangeCode,
  getRecentActivities,
  filterTodayActivities,
  metresToKm,
  StravaActivity,
} from '../lib/strava';

// Make sure any open auth sessions are dismissed cleanly on iOS
WebBrowser.maybeCompleteAuthSession();

// ─── useStravaConnect ─────────────────────────────────────────────────────────

interface UseStravaConnectReturn {
  connect: () => Promise<void>;
  loading: boolean;
  error: string | null;
  connected: boolean;
}

export function useStravaConnect(userId?: string): UseStravaConnectReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Sync initial connected state from Supabase profile
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('users')
          .select('strava_connected')
          .eq('id', userId)
          .single();
        if (data?.strava_connected) setConnected(true);
      } catch {
        // non-blocking — also try profiles table
        try {
          const { data } = await supabase
            .from('profiles')
            .select('strava_connected')
            .eq('id', userId)
            .single();
          if (data?.strava_connected) setConnected(true);
        } catch {}
      }
    })();
  }, [userId]);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const authUrl = buildStravaAuthUrl();

      // Open OAuth flow in an in-app browser
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'protocol://strava-callback',
      );

      if (result.type !== 'success') {
        // User cancelled or browser was dismissed
        setLoading(false);
        return;
      }

      // Extract the code from the redirect URL
      const url = result.url;
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      if (!codeMatch) {
        throw new Error('No authorization code in Strava redirect URL');
      }
      const code = codeMatch[1];

      // Exchange code for tokens
      const tokenData = await exchangeCode(code);

      // Persist token in Supabase user_integrations table
      const currentUserId =
        userId ?? (await supabase.auth.getUser()).data.user?.id;

      if (currentUserId) {
        // Upsert integration record
        await (supabase as any).from('user_integrations').upsert(
          {
            user_id: currentUserId,
            provider: 'strava',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_at,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider' },
        );

        // Mark strava_connected = true in users table (and profiles fallback)
        await (supabase as any)
          .from('users')
          .update({ strava_connected: true })
          .eq('id', currentUserId);

        // Also update profiles table in case that is the active schema
        await supabase
          .from('profiles')
          .update({ strava_connected: true } as any)
          .eq('id', currentUserId);
      }

      setConnected(true);
    } catch (err: any) {
      console.error('[useStravaConnect] error:', err);
      setError(err?.message ?? 'Failed to connect Strava');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { connect, loading, error, connected };
}

// ─── useStravaActivities ──────────────────────────────────────────────────────

interface UseStravaActivitiesReturn {
  activities: StravaActivity[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useStravaActivities(userId?: string): UseStravaActivitiesReturn {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      // Get access token from Supabase
      const { data: integration, error: intErr } = await (supabase as any)
        .from('user_integrations')
        .select('access_token, expires_at')
        .eq('user_id', userId)
        .eq('provider', 'strava')
        .single();

      if (intErr || !integration?.access_token) {
        setActivities([]);
        return;
      }

      const fetched = await getRecentActivities(integration.access_token);
      setActivities(fetched);
    } catch (err: any) {
      console.error('[useStravaActivities] error:', err);
      setError(err?.message ?? 'Failed to fetch Strava activities');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { activities, loading, error, refresh: fetch_ };
}

// ─── useActivitySync ──────────────────────────────────────────────────────────

interface UseActivitySyncReturn {
  sync: () => Promise<void>;
  syncing: boolean;
  error: string | null;
  lastSyncedProgress: number | null;
}

/**
 * Syncs today's Strava activities to challenge_participants.progress.
 * Progress is stored as kilometres (distance / 1000).
 */
export function useActivitySync(challengeId?: string): UseActivitySyncReturn {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedProgress, setLastSyncedProgress] = useState<number | null>(null);

  const sync = useCallback(async () => {
    if (!challengeId) return;
    setSyncing(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get Strava token
      const { data: integration, error: intErr } = await (supabase as any)
        .from('user_integrations')
        .select('access_token')
        .eq('user_id', user.id)
        .eq('provider', 'strava')
        .single();

      if (intErr || !integration?.access_token) {
        throw new Error('Strava not connected');
      }

      // Fetch recent activities and filter to today's
      const all = await getRecentActivities(integration.access_token);
      const todays = filterTodayActivities(all);

      // Sum distance from today's activities (in km)
      const totalKm = todays.reduce(
        (acc, a) => acc + metresToKm(a.distance),
        0,
      );

      // Update challenge_participants.progress
      await (supabase as any)
        .from('challenge_participants')
        .update({
          progress: totalKm,
          updated_at: new Date().toISOString(),
        })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id);

      setLastSyncedProgress(totalKm);
    } catch (err: any) {
      console.error('[useActivitySync] error:', err);
      setError(err?.message ?? 'Activity sync failed');
    } finally {
      setSyncing(false);
    }
  }, [challengeId]);

  return { sync, syncing, error, lastSyncedProgress };
}
