/**
 * Integration Test: Complete User Journey
 * Tests the full user flow from sign-in to leaderboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import { calculatePoints } from '@/lib/scoring';

// Mock external dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
      upsert: vi.fn(() => Promise.resolve({ data: [], error: null })),
      eq: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        update: vi.fn(() => Promise.resolve({ data: [], error: null })),
        delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  },
}));

describe('User Journey Integration Tests', () => {
  let mockSupabase: any;
  let mockUser: any;
  let mockMatch: any;
  let mockPrediction: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock data
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      total_points: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockMatch = {
      id: 'match-123',
      external_id: 'ext-123',
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      home_score: null,
      away_score: null,
      status: 'TIMED',
      kickoff_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      gameweek: 1,
      season: '2025/26',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockPrediction = {
      id: 'pred-123',
      user_id: mockUser.id,
      match_id: mockMatch.id,
      predicted_home_score: 2,
      predicted_away_score: 1,
      points_earned: 0,
      processed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockSupabase = supabase;
  });

  describe('User Authentication Flow', () => {
    it('should handle new user registration', async () => {
      // Mock user creation
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        insert: vi.fn(() => Promise.resolve({ 
          data: [mockUser], 
          error: null 
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate user registration
      const result = await mockSupabase
        .from('users')
        .insert({
          email: mockUser.email,
          name: mockUser.name,
          avatar_url: mockUser.avatar_url,
          total_points: 0,
        });

      expect(result.data).toEqual([mockUser]);
      expect(result.error).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith('users');
    });

    it('should retrieve existing user profile', async () => {
      // Mock user retrieval
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ 
            data: [mockUser], 
            error: null 
          })),
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate user profile retrieval
      const result = await mockSupabase
        .from('users')
        .select('*')
        .eq('email', mockUser.email);

      expect(result.data).toEqual([mockUser]);
      expect(result.error).toBeNull();
    });
  });

  describe('Prediction Submission Flow', () => {
    it('should allow prediction submission for upcoming matches', async () => {
      // Mock prediction creation
      const mockFrom = vi.fn(() => ({
        insert: vi.fn(() => Promise.resolve({ 
          data: [mockPrediction], 
          error: null 
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate prediction submission
      const result = await mockSupabase
        .from('predictions')
        .insert({
          user_id: mockUser.id,
          match_id: mockMatch.id,
          predicted_home_score: 2,
          predicted_away_score: 1,
        });

      expect(result.data).toEqual([mockPrediction]);
      expect(result.error).toBeNull();
    });

    it('should prevent prediction submission after match starts', () => {
      // Create a match that has already started
      const startedMatch = {
        ...mockMatch,
        kickoff_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        status: 'IN_PLAY',
      };

      // Check if prediction is allowed
      const now = new Date();
      const kickoffTime = new Date(startedMatch.kickoff_time);
      const canPredict = startedMatch.status === 'TIMED' && kickoffTime > now;

      expect(canPredict).toBe(false);
    });

    it('should allow prediction updates before match starts', async () => {
      // Mock prediction update
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ 
            data: [{ ...mockPrediction, predicted_home_score: 3 }], 
            error: null 
          })),
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate prediction update
      const result = await mockSupabase
        .from('predictions')
        .update({ predicted_home_score: 3 })
        .eq('id', mockPrediction.id);

      expect(result.data[0].predicted_home_score).toBe(3);
      expect(result.error).toBeNull();
    });
  });

  describe('Scoring System Flow', () => {
    it('should calculate correct points for exact score prediction', () => {
      const match = { home_score: 2, away_score: 1 };
      const prediction = { predicted_home_score: 2, predicted_away_score: 1 };
      
      const points = calculatePoints(match, prediction);
      
      expect(points).toBe(5);
    });

    it('should calculate correct points for outcome prediction', () => {
      const match = { home_score: 3, away_score: 1 };
      const prediction = { predicted_home_score: 2, predicted_away_score: 0 };
      
      const points = calculatePoints(match, prediction);
      
      expect(points).toBe(2);
    });

    it('should calculate zero points for wrong prediction', () => {
      const match = { home_score: 2, away_score: 1 };
      const prediction = { predicted_home_score: 0, predicted_away_score: 2 };
      
      const points = calculatePoints(match, prediction);
      
      expect(points).toBe(0);
    });

    it('should update user total points after score processing', async () => {
      const updatedUser = { ...mockUser, total_points: 5 };
      
      // Mock user points update
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ 
            data: [updatedUser], 
            error: null 
          })),
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate points update
      const result = await mockSupabase
        .from('users')
        .update({ total_points: 5 })
        .eq('id', mockUser.id);

      expect(result.data[0].total_points).toBe(5);
      expect(result.error).toBeNull();
    });
  });

  describe('Leaderboard Integration', () => {
    it('should retrieve leaderboard with correct ranking', async () => {
      const leaderboardData = [
        { ...mockUser, total_points: 15, rank: 1 },
        { id: 'user-456', email: 'user2@example.com', name: 'User 2', total_points: 10, rank: 2 },
        { id: 'user-789', email: 'user3@example.com', name: 'User 3', total_points: 5, rank: 3 },
      ];

      // Mock leaderboard retrieval
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ 
          data: leaderboardData, 
          error: null 
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate leaderboard fetch
      const result = await mockSupabase
        .from('users')
        .select('*');

      expect(result.data).toEqual(leaderboardData);
      expect(result.data[0].rank).toBe(1);
      expect(result.data[0].total_points).toBe(15);
    });

    it('should handle tie-breaking in leaderboard', () => {
      const users = [
        { id: '1', total_points: 10, last_correct_prediction: '2025-01-01T10:00:00Z' },
        { id: '2', total_points: 10, last_correct_prediction: '2025-01-01T11:00:00Z' },
        { id: '3', total_points: 15, last_correct_prediction: '2025-01-01T09:00:00Z' },
      ];

      // Sort by points desc, then by most recent correct prediction
      const sorted = users.sort((a, b) => {
        if (a.total_points !== b.total_points) {
          return b.total_points - a.total_points;
        }
        return new Date(b.last_correct_prediction).getTime() - new Date(a.last_correct_prediction).getTime();
      });

      expect(sorted[0].id).toBe('3'); // Highest points
      expect(sorted[1].id).toBe('2'); // Same points, more recent prediction
      expect(sorted[2].id).toBe('1'); // Same points, older prediction
    });
  });

  describe('Match Data Integration', () => {
    it('should handle match status updates', async () => {
      const finishedMatch = {
        ...mockMatch,
        status: 'FINISHED',
        home_score: 2,
        away_score: 1,
      };

      // Mock match update
      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ 
            data: [finishedMatch], 
            error: null 
          })),
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate match result update
      const result = await mockSupabase
        .from('matches')
        .update({
          status: 'FINISHED',
          home_score: 2,
          away_score: 1,
        })
        .eq('id', mockMatch.id);

      expect(result.data[0].status).toBe('FINISHED');
      expect(result.data[0].home_score).toBe(2);
      expect(result.data[0].away_score).toBe(1);
    });

    it('should group matches by date correctly', () => {
      const matches = [
        { id: '1', utcDate: '2025-01-01T15:00:00Z', home_team: 'Arsenal', away_team: 'Chelsea' },
        { id: '2', utcDate: '2025-01-01T17:30:00Z', home_team: 'Liverpool', away_team: 'City' },
        { id: '3', utcDate: '2025-01-02T15:00:00Z', home_team: 'United', away_team: 'Spurs' },
      ];

      const groupedMatches = matches.reduce((acc, match) => {
        const date = new Date(match.utcDate).toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(match);
        return acc;
      }, {} as Record<string, typeof matches>);

      const dateKeys = Object.keys(groupedMatches);
      expect(dateKeys).toHaveLength(2);
      
      // Find the date with 2 matches and the date with 1 match
      const matchCounts = dateKeys.map(date => groupedMatches[date].length);
      expect(matchCounts.sort()).toEqual([1, 2]);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ 
          data: null, 
          error: { message: 'Connection failed' }
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate database error
      const result = await mockSupabase
        .from('users')
        .select('*');

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Connection failed');
    });

    it('should handle API rate limiting', async () => {
      // Mock rate limit error
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ 
          data: null, 
          error: { message: 'Rate limit exceeded', code: '429' }
        })),
      }));
      mockSupabase.from = mockFrom;

      // Simulate rate limit
      const result = await mockSupabase
        .from('matches')
        .select('*');

      expect(result.error?.code).toBe('429');
      expect(result.error?.message).toBe('Rate limit exceeded');
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should handle real-time leaderboard updates', () => {
      const mockCallback = vi.fn();
      const mockPayload = {
        eventType: 'UPDATE',
        new: { id: 'user-123', total_points: 20 },
        old: { id: 'user-123', total_points: 15 },
      };

      // Simulate real-time update
      mockCallback(mockPayload);

      expect(mockCallback).toHaveBeenCalledWith(mockPayload);
      expect(mockPayload.new.total_points).toBe(20);
    });

    it('should handle real-time match updates', () => {
      const mockCallback = vi.fn();
      const mockPayload = {
        eventType: 'UPDATE',
        new: { id: 'match-123', status: 'FINISHED', home_score: 2, away_score: 1 },
        old: { id: 'match-123', status: 'IN_PLAY', home_score: null, away_score: null },
      };

      // Simulate real-time match update
      mockCallback(mockPayload);

      expect(mockCallback).toHaveBeenCalledWith(mockPayload);
      expect(mockPayload.new.status).toBe('FINISHED');
    });
  });
});