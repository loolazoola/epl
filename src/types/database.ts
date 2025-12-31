export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  external_id: string;
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  status: 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';
  kickoff_time: string;
  gameweek?: number;
  season: string;
  created_at: string;
  updated_at: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  points_earned: number;
  processed: boolean;
  created_at: string;
  updated_at: string;
  match?: Match;
}

export interface LeaderboardEntry {
  user: User;
  rank: number;
  points: number;
  correct_predictions: number;
  total_predictions: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

// Supabase Database Types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;
      };
      matches: {
        Row: Match;
        Insert: Omit<Match, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Match, 'id' | 'created_at' | 'updated_at'>>;
      };
      predictions: {
        Row: Prediction;
        Insert: Omit<Prediction, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Prediction, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      match_status: 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';
    };
  };
}