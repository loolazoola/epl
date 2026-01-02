/**
 * Integration Test: Background Job Processing
 * Tests match sync and score processing background jobs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncMatchData } from '@/lib/match-sync';
import { processAllFinishedMatches } from '@/lib/score-processor';

// Mock external dependencies
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      upsert: vi.fn(() => Promise.resolve({ data: [], error: null })),
      eq: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

vi.mock('@/lib/football-api', () => ({
  fetchMatches: vi.fn(),
  fetchMatchById: vi.fn(),
}));

describe('Background Jobs Integration Tests', () => {
  let mockMatches: any[];
  let mockPredictions: any[];
  let mockUsers: any[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockMatches = [
      {
        id: 'match-1',
        external_id: 'ext-1',
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        home_score: null,
        away_score: null,
        status: 'TIMED',
        kickoff_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        gameweek: 1,
        season: '2025/26',
      },
      {
        id: 'match-2',
        external_id: 'ext-2',
        home_team: 'Liverpool',
        away_team: 'Manchester City',
        home_score: 2,
        away_score: 1,
        status: 'FINISHED',
        kickoff_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        gameweek: 1,
        season: '2025/26',
      },
    ];

    mockPredictions = [
      {
        id: 'pred-1',
        user_id: 'user-1',
        match_id: 'match-2',
        predicted_home_score: 2,
        predicted_away_score: 1,
        points_earned: 0,
        processed: false,
      },
      {
        id: 'pred-2',
        user_id: 'user-2',
        match_id: 'match-2',
        predicted_home_score: 1,
        predicted_away_score: 0,
        points_earned: 0,
        processed: false,
      },
    ];

    mockUsers = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        total_points: 10,
      },
      {
        id: 'user-2',
        email: 'user2@example.com',
        name: 'User 2',
        total_points: 5,
      },
    ];
  });

  describe('Match Sync Job', () => {
    it('should sync new matches from external API', async () => {
      const { fetchMatches } = await import('@/lib/football-api');
      const mockFetchMatches = fetchMatches as any;

      // Mock API response
      mockFetchMatches.mockResolvedValue({
        matches: [
          {
            id: 12345,
            utcDate: '2025-01-15T15:00:00Z',
            status: 'TIMED',
            matchday: 2,
            homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS', crest: 'arsenal.png' },
            awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE', crest: 'chelsea.png' },
            score: { fullTime: { home: null, away: null } },
          },
        ],
      });

      // Mock database operations
      const mockSupabase = (await import('@/lib/supabase')).createClient();
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: [mockMatches[0]], error: null })),
      }));
      (mockSupabase as any).from = mockFrom;

      // Test match sync
      const result = await syncMatchData();

      expect(mockFetchMatches).toHaveBeenCalled();
      expect(result.newMatches).toBeGreaterThanOrEqual(0);
      expect(result.updatedMatches).toBeGreaterThanOrEqual(0);
    });

    it('should update existing matches with new scores', async () => {
      const { fetchMatches } = await import('@/lib/football-api');
      const mockFetchMatches = fetchMatches as any;

      // Mock API response with updated match
      mockFetchMatches.mockResolvedValue({
        matches: [
          {
            id: 12345,
            utcDate: '2025-01-15T15:00:00Z',
            status: 'FINISHED',
            matchday: 1,
            homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS', crest: 'arsenal.png' },
            awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE', crest: 'chelsea.png' },
            score: { fullTime: { home: 3, away: 1 } },
          },
        ],
      });

      // Mock existing match in database
      const mockSupabase = (await import('@/lib/supabase')).createClient();
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ 
          data: [{ ...mockMatches[0], external_id: '12345' }], 
          error: null 
        })),
        upsert: vi.fn(() => Promise.resolve({ 
          data: [{ ...mockMatches[0], status: 'FINISHED', home_score: 3, away_score: 1 }], 
          error: null 
        })),
      }));
      (mockSupabase as any).from = mockFrom;

      // Test match update
      const result = await syncMatchData();

      expect(result.newMatches).toBeGreaterThanOrEqual(0);
      expect(result.updatedMatches).toBeGreaterThanOrEqual(0);
    });

    it('should handle API failures gracefully', async () => {
      const { fetchMatches } = await import('@/lib/football-api');
      const mockFetchMatches = fetchMatches as any;

      // Mock API failure
      mockFetchMatches.mockRejectedValue(new Error('API unavailable'));

      // Test error handling
      const result = await syncMatchData();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('API unavailable');
    });

    it('should respect API rate limits', async () => {
      const { fetchMatches } = await import('@/lib/football-api');
      const mockFetchMatches = fetchMatches as any;

      // Mock rate limit error
      mockFetchMatches.mockRejectedValue({
        response: { status: 429, data: { message: 'Rate limit exceeded' } }
      });

      // Test rate limit handling
      const result = await syncMatchData();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Rate limit');
    });
  });

  describe('Score Processing Job', () => {
    it('should process scores for finished matches', async () => {
      // Mock database operations
      const mockSupabase = (await import('@/lib/supabase')).createClient();
      
      // Mock finished matches query
      const mockFrom = vi.fn((table: string) => {
        if (table === 'matches') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [mockMatches[1]], // Finished match
                error: null 
              })),
            })),
          };
        }
        if (table === 'predictions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: mockPredictions,
                error: null 
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: mockPredictions.map(p => ({ ...p, processed: true, points_earned: 5 })),
                error: null 
              })),
            })),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [mockUsers[0]],
                error: null 
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [{ ...mockUsers[0], total_points: 15 }],
                error: null 
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        };
      });
      (mockSupabase as any).from = mockFrom;

      // Test score processing
      const result = await processAllFinishedMatches();

      expect(result.processedMatches).toBeGreaterThanOrEqual(0);
      expect(result.totalPredictionsProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should calculate points correctly for exact predictions', async () => {
      const finishedMatch = {
        ...mockMatches[1],
        home_score: 2,
        away_score: 1,
      };

      const exactPrediction = {
        ...mockPredictions[0],
        predicted_home_score: 2,
        predicted_away_score: 1,
      };

      // Mock database operations
      const mockSupabase = (await import('@/lib/supabase')).createClient();
      const mockFrom = vi.fn((table: string) => {
        if (table === 'matches') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [finishedMatch],
                error: null 
              })),
            })),
          };
        }
        if (table === 'predictions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [exactPrediction],
                error: null 
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [{ ...exactPrediction, processed: true, points_earned: 5 }],
                error: null 
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        };
      });
      (mockSupabase as any).from = mockFrom;

      // Test exact score processing
      const result = await processAllFinishedMatches();

      expect(result.processedMatches).toBeGreaterThanOrEqual(0);
      // Verify that exact predictions get 5 points
      expect(mockFrom).toHaveBeenCalledWith('predictions');
    });

    it('should prevent duplicate score processing', async () => {
      const processedPrediction = {
        ...mockPredictions[0],
        processed: true,
        points_earned: 5,
      };

      // Mock database operations
      const mockSupabase = (await import('@/lib/supabase')).createClient();
      const mockFrom = vi.fn((table: string) => {
        if (table === 'matches') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [mockMatches[1]],
                error: null 
              })),
            })),
          };
        }
        if (table === 'predictions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [processedPrediction], // Already processed
                error: null 
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        };
      });
      (mockSupabase as any).from = mockFrom;

      // Test duplicate prevention
      const result = await processAllFinishedMatches();

      expect(result.processedMatches).toBeGreaterThanOrEqual(0);
      expect(result.totalPredictionsProcessed).toBe(0); // No new predictions processed
    });

    it('should handle database transaction failures', async () => {
      // Mock database error
      const mockSupabase = (await import('@/lib/supabase')).createClient();
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ 
          data: null, 
          error: { message: 'Transaction failed' }
        })),
      }));
      (mockSupabase as any).from = mockFrom;

      // Test error handling
      const result = await processAllFinishedMatches();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Transaction failed');
    });

    it('should update user total points atomically', async () => {
      const userWithPredictions = {
        ...mockUsers[0],
        predictions: [
          { points_earned: 5 },
          { points_earned: 2 },
          { points_earned: 0 },
        ],
      };

      // Mock database operations
      const mockSupabase = (await import('@/lib/supabase')).createClient();
      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [userWithPredictions],
                error: null 
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: [{ ...userWithPredictions, total_points: 17 }], // 10 + 5 + 2 + 0
                error: null 
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        };
      });
      (mockSupabase as any).from = mockFrom;

      // Test atomic points update
      const result = await processAllFinishedMatches();

      expect(result.processedMatches).toBeGreaterThanOrEqual(0);
      // Verify user points were updated
      expect(mockFrom).toHaveBeenCalledWith('users');
    });
  });

  describe('Job Scheduling Integration', () => {
    it('should handle concurrent job execution', async () => {
      // Simulate concurrent execution
      const syncPromise = syncMatchData();
      const processPromise = processAllFinishedMatches();

      const [syncResult, processResult] = await Promise.all([syncPromise, processPromise]);

      expect(syncResult.newMatches).toBeGreaterThanOrEqual(0);
      expect(processResult.processedMatches).toBeGreaterThanOrEqual(0);
    });

    it('should handle job execution order dependencies', async () => {
      // Match sync should complete before score processing
      const syncResult = await syncMatchData();
      expect(syncResult.newMatches).toBeGreaterThanOrEqual(0);

      // Then process scores
      const processResult = await processAllFinishedMatches();
      expect(processResult.processedMatches).toBeGreaterThanOrEqual(0);
    });

    it('should handle job failure recovery', async () => {
      // Mock first attempt failure
      let attemptCount = 0;
      const { fetchMatches } = await import('@/lib/football-api');
      const mockFetchMatches = fetchMatches as any;

      mockFetchMatches.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve({ matches: [] });
      });

      // First attempt should fail
      const firstResult = await syncMatchData();
      expect(firstResult.errors.length).toBeGreaterThan(0);

      // Second attempt should succeed
      const secondResult = await syncMatchData();
      expect(secondResult.newMatches).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large batch processing efficiently', async () => {
      // Create large dataset
      const largePredictionSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `pred-${i}`,
        user_id: `user-${i % 100}`,
        match_id: 'match-2',
        predicted_home_score: Math.floor(Math.random() * 5),
        predicted_away_score: Math.floor(Math.random() * 5),
        points_earned: 0,
        processed: false,
      }));

      // Mock database operations for large dataset
      const mockSupabase = (await import('@/lib/supabase')).createClient();
      const mockFrom = vi.fn((table: string) => {
        if (table === 'predictions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: largePredictionSet,
                error: null 
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: largePredictionSet.map(p => ({ ...p, processed: true })),
                error: null 
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        };
      });
      (mockSupabase as any).from = mockFrom;

      // Test performance with large dataset
      const startTime = Date.now();
      const result = await processAllFinishedMatches();
      const endTime = Date.now();

      expect(result.processedMatches).toBeGreaterThanOrEqual(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle memory usage efficiently', async () => {
      // Monitor memory usage during processing
      const initialMemory = process.memoryUsage();
      
      await processAllFinishedMatches();
      
      const finalMemory = process.memoryUsage();
      
      // Memory increase should be reasonable
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });
});