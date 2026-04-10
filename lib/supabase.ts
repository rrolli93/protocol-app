import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Database type definitions
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          handle: string;
          avatar_url: string | null;
          wallet_address: string | null;
          strava_connected: boolean;
          oura_connected: boolean;
          whoop_connected: boolean;
          apple_health_connected: boolean;
          challenges_won: number;
          total_earned_usdc: number;
          current_streak: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      challenges: {
        Row: {
          id: string;
          creator_id: string;
          name: string;
          pillar_id: string;
          goal: number;
          duration_days: number;
          stake_usdc: number;
          privacy: 'public' | 'friends' | 'private';
          contract_address: string | null;
          total_pot_usdc: number;
          participant_count: number;
          starts_at: string;
          ends_at: string;
          created_at: string;
          status: 'active' | 'completed' | 'cancelled';
        };
        Insert: Omit<Database['public']['Tables']['challenges']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['challenges']['Insert']>;
      };
      challenge_participants: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string;
          progress: number;
          stake_usdc: number;
          rank: number | null;
          completed: boolean;
          joined_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['challenge_participants']['Row'], 'id' | 'joined_at' | 'updated_at'> & {
          id?: string;
          joined_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['challenge_participants']['Insert']>;
      };
      activity_feed: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          type: 'joined' | 'progress' | 'completed' | 'won';
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_feed']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['activity_feed']['Insert']>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Challenge = Tables<'challenges'>;
export type Profile = Tables<'profiles'>;
export type ChallengeParticipant = Tables<'challenge_participants'>;
export type ActivityFeedItem = Tables<'activity_feed'>;

export interface LeaderboardEntry {
  rank: number;
  user: Profile;
  progress: number;
  target: number;
  stake: number;
  completed: boolean;
}

class SupabaseStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  }
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: new SupabaseStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

export const getAvatarUrl = (avatarPath: string | null): string | null => {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http')) return avatarPath;
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
  return data.publicUrl;
};
