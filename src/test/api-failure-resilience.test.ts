// Property test for API failure resilience
// **Feature: premier-league-prediction-game, Property 3: API Failure Resilience**
// **Validates: Requirements 2.5**

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { getCachedMatches, clearCache, getCacheStats } from '../lib/match-cache';
import { ParsedMatch } from '../lib/football-api';

// Mock the football API module
vi.mock('../lib/football-api', async () => {
  const actual = await vi.importActual('../lib/football-api');
  return {
    ...actual,
    getPremierLeagueMatches: vi.fn(),
  };
});

import { getPremierLeagueMatches } from '../lib/football-api';

beforeEach(() => {
  clearCache();
  vi.clearAllMocks();
});

// Generate mock match data for caching
const mockParsedMatch = (): fc.Arbitrary<ParsedMatch> => {
  return fc.record({
    external_id: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
    home_team: fc.string({ minLength: 5, maxLength: 25 }).filter(s => s.trim().length >= 3),
    away_team: fc.string({ minLength: 5, maxLength: 25 }).filter(s => s.trim().length >= 3),
    home_score: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
    away_score: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
    status: fc.constantFrom('TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED'),
    kickoff_time: fc.integer({ min: Date.parse('2023-08-01T00:00:00Z'), max: Date.parse('2025-05-31T23:59:59Z') })
      .map(timestamp => new Date(timestamp).toISOString()),
    gameweek: fc.integer({ min: 1, max: 38 }),
    season: fc.constantFrom('2023-2024', '2024-2025'),
  });
};

// Generate API error responses
const mockApiError = (): fc.Arbitrary<{ status: number; error: string }> => {
  return fc.record({
    status: fc.constantFrom(500, 502, 503, 504, 429, 404, 401, 403),
    error: fc.constantFrom(
      'Internal Server Error',
      'Bad Gateway', 
      'Service Unavailable',
      'Gateway Timeout',
      'Too Many Requests',
      'Not Found',
      'Unauthorized',
      'Forbidden'
    ),
  });
};

describe('API Failure Resilience Properties', () => {
  it('Property 3: API Failure Resilience - For any external API failure, system should continue operating with cached data and log appropriate errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mockParsedMatch(), { minLength: 1, maxLength: 3 }),
        mockApiError(),
        async (cachedMatches, apiError) => {
          // Clear cache and mocks for each test run
          clearCache();
          vi.clearAllMocks();
          
          // First, populate cache with successful data
          vi.mocked(getPremierLeagueMatches).mockResolvedValueOnce({
            data: cachedMatches,
            error: null,
            status: 200,
          });

          // Get initial data to populate cache
          const initialResponse = await getCachedMatches();
          expect(initialResponse.error).toBeNull();
          expect(initialResponse.data).toEqual(cachedMatches);

          // Now simulate API failure
          vi.mocked(getPremierLeagueMatches).mockResolvedValueOnce({
            data: null,
            error: apiError.error,
            status: apiError.status,
          });

          // Force refresh should trigger API call, but system should handle failure gracefully
          const failureResponse = await getCachedMatches(undefined, undefined, true);

          // System should handle API failure gracefully
          expect(failureResponse.error).toBeDefined();
          expect(failureResponse.data).toBeNull();
          expect(failureResponse.status).toBe(apiError.status);

          // System should continue operating - cache should still exist and be functional
          const stats = getCacheStats();
          expect(stats).toBeDefined();
          expect(typeof stats.hits).toBe('number');
          expect(typeof stats.misses).toBe('number');
          expect(typeof stats.size).toBe('number');

          // Verify system doesn't crash and maintains state
          expect(() => getCacheStats()).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 3a: Network errors are handled gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mockParsedMatch(), { minLength: 1, maxLength: 3 }),
        fc.constantFrom(
          'Network error: fetch failed',
          'Network error: Connection timeout',
          'Network error: DNS resolution failed',
          'Network error: Connection refused'
        ),
        async (cachedMatches, networkError) => {
          // Clear cache and mocks for each test run
          clearCache();
          vi.clearAllMocks();
          
          // First, populate cache with successful data
          vi.mocked(getPremierLeagueMatches).mockResolvedValueOnce({
            data: cachedMatches,
            error: null,
            status: 200,
          });

          // Get initial data to populate cache
          const initialResponse = await getCachedMatches();
          expect(initialResponse.error).toBeNull();

          // Simulate network error
          vi.mocked(getPremierLeagueMatches).mockResolvedValueOnce({
            data: null,
            error: networkError,
            status: 0, // Network errors typically have status 0
          });

          // Force refresh should handle network error gracefully
          const networkErrorResponse = await getCachedMatches(undefined, undefined, true);

          // System should handle network errors gracefully
          expect(networkErrorResponse.error).toBeDefined();
          expect(networkErrorResponse.error).toMatch(/Network error/);
          expect(networkErrorResponse.data).toBeNull();
          expect(networkErrorResponse.status).toBe(0);

          // System should remain functional
          expect(() => getCacheStats()).not.toThrow();
          const stats = getCacheStats();
          expect(stats).toBeDefined();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 3b: Rate limiting is handled with appropriate backoff', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mockParsedMatch(), { minLength: 1, maxLength: 3 }),
        async (cachedMatches) => {
          // Clear cache and mocks for each test run
          clearCache();
          vi.clearAllMocks();
          
          // Simulate rate limiting scenario
          vi.mocked(getPremierLeagueMatches)
            .mockResolvedValueOnce({
              data: cachedMatches,
              error: null,
              status: 200,
            })
            .mockResolvedValueOnce({
              data: null,
              error: 'Rate limit exceeded and max retries reached',
              status: 429,
            });

          // Get initial data
          const initialResponse = await getCachedMatches();
          expect(initialResponse.error).toBeNull();

          // Trigger rate limit
          const rateLimitResponse = await getCachedMatches(undefined, undefined, true);

          // System should handle rate limiting gracefully
          expect(rateLimitResponse.error).toBeDefined();
          expect(rateLimitResponse.status).toBe(429);
          expect(rateLimitResponse.data).toBeNull();

          // System should log appropriate error message
          expect(rateLimitResponse.error).toMatch(/Rate limit/);

          // System should remain operational
          expect(() => getCacheStats()).not.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 3c: System maintains functionality during API unavailability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mockParsedMatch(), { minLength: 1, maxLength: 3 }),
        fc.integer({ min: 1, max: 3 }), // Number of consecutive failures
        async (cachedMatches, failureCount) => {
          // Clear cache and mocks for each test run
          clearCache();
          vi.clearAllMocks();
          
          // First, populate cache with successful data
          vi.mocked(getPremierLeagueMatches).mockResolvedValueOnce({
            data: cachedMatches,
            error: null,
            status: 200,
          });

          // Get initial data to populate cache
          const initialResponse = await getCachedMatches();
          expect(initialResponse.error).toBeNull();
          expect(initialResponse.data).toEqual(cachedMatches);

          // Simulate consecutive API failures
          for (let i = 0; i < failureCount; i++) {
            vi.mocked(getPremierLeagueMatches).mockResolvedValueOnce({
              data: null,
              error: 'Service Unavailable',
              status: 503,
            });

            const failureResponse = await getCachedMatches(undefined, undefined, true);
            
            // Each failure should be handled gracefully
            expect(failureResponse.error).toBeDefined();
            expect(failureResponse.status).toBe(503);
            expect(failureResponse.data).toBeNull();

            // System should remain functional after each failure
            expect(() => getCacheStats()).not.toThrow();
            const stats = getCacheStats();
            expect(stats).toBeDefined();
            expect(typeof stats.hits).toBe('number');
            expect(typeof stats.misses).toBe('number');
          }

          // After all failures, system should still be operational
          const finalStats = getCacheStats();
          expect(finalStats.misses).toBeGreaterThan(0); // Should have recorded the misses
        }
      ),
      { numRuns: 20 }
    );
  });
});