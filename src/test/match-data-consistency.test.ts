// Property test for match data consistency
// **Feature: premier-league-prediction-game, Property 2: Match Data Consistency**
// **Validates: Requirements 2.2, 2.3**

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ParsedMatch, FootballDataMatch } from '../lib/football-api';
import { getCachedMatches, clearCache, getCacheStats } from '../lib/match-cache';

// Mock the football API module
vi.mock('../lib/football-api', async () => {
  const actual = await vi.importActual('../lib/football-api');
  return {
    ...actual,
    getPremierLeagueMatches: vi.fn(),
  };
});

import { getPremierLeagueMatches } from '../lib/football-api';

// Mock the football API to control test data
const mockFootballDataMatch = (): fc.Arbitrary<FootballDataMatch> => {
  return fc.record({
    id: fc.integer({ min: 1, max: 999999 }),
    utcDate: fc.date({ min: new Date('2023-08-01T00:00:00Z'), max: new Date('2025-05-31T23:59:59Z') })
      .map(date => date.toISOString()),
    status: fc.constantFrom('TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'SUSPENDED', 'CANCELLED'),
    matchday: fc.integer({ min: 1, max: 38 }),
    homeTeam: fc.record({
      id: fc.integer({ min: 1, max: 20 }),
      name: fc.string({ minLength: 5, maxLength: 25 }).filter(s => s.trim().length >= 3),
      crest: fc.webUrl(),
    }),
    awayTeam: fc.record({
      id: fc.integer({ min: 1, max: 20 }),
      name: fc.string({ minLength: 5, maxLength: 25 }).filter(s => s.trim().length >= 3),
      crest: fc.webUrl(),
    }),
    score: fc.record({
      fullTime: fc.record({
        home: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
        away: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
      }),
    }),
  });
};

beforeEach(() => {
  clearCache();
  vi.clearAllMocks();
});

describe('Match Data Consistency Properties', () => {
  it('Property 2: Match Data Consistency - For any match data received from external API, system should cache all required fields and maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mockFootballDataMatch(), { minLength: 1, maxLength: 5 }),
        async (matches) => {
          // Clear cache and mocks for each test run
          clearCache();
          vi.clearAllMocks();
          
          // Parse the mock data using the same logic as the real function
          const parsedMatches = matches.map(match => {
            const matchDate = new Date(match.utcDate);
            const year = matchDate.getFullYear();
            const month = matchDate.getMonth() + 1;
            const season = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

            return {
              external_id: match.id.toString(),
              home_team: match.homeTeam.name,
              away_team: match.awayTeam.name,
              home_score: match.score.fullTime.home,
              away_score: match.score.fullTime.away,
              status: match.status === 'POSTPONED' || match.status === 'SUSPENDED' || match.status === 'CANCELLED' 
                ? 'TIMED' as const
                : match.status as 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED',
              kickoff_time: match.utcDate,
              gameweek: match.matchday,
              season,
            };
          });

          // Mock the API function to return consistent data
          vi.mocked(getPremierLeagueMatches).mockResolvedValue({
            data: parsedMatches,
            error: null,
            status: 200,
          });

          // First call should fetch from API and cache
          const firstResponse = await getCachedMatches();
          
          // Verify successful response
          expect(firstResponse.error).toBeNull();
          expect(firstResponse.data).toBeDefined();
          expect(firstResponse.cached).toBeFalsy(); // First call should not be cached
          
          if (firstResponse.data) {
            // Verify all required fields are present and correctly mapped
            expect(firstResponse.data.length).toBe(matches.length);
            
            for (let i = 0; i < firstResponse.data.length; i++) {
              const parsedMatch = firstResponse.data[i];
              const originalMatch = matches[i];
              
              // Check all required fields are present
              expect(parsedMatch.external_id).toBeDefined();
              expect(parsedMatch.home_team).toBeDefined();
              expect(parsedMatch.away_team).toBeDefined();
              expect(parsedMatch.status).toBeDefined();
              expect(parsedMatch.kickoff_time).toBeDefined();
              expect(parsedMatch.gameweek).toBeDefined();
              expect(parsedMatch.season).toBeDefined();
              
              // Check field mapping consistency
              expect(parsedMatch.external_id).toBe(originalMatch.id.toString());
              expect(parsedMatch.home_team).toBe(originalMatch.homeTeam.name);
              expect(parsedMatch.away_team).toBe(originalMatch.awayTeam.name);
              expect(parsedMatch.home_score).toBe(originalMatch.score.fullTime.home);
              expect(parsedMatch.away_score).toBe(originalMatch.score.fullTime.away);
              expect(parsedMatch.kickoff_time).toBe(originalMatch.utcDate);
              expect(parsedMatch.gameweek).toBe(originalMatch.matchday);
              
              // Check status mapping
              const expectedStatus = originalMatch.status === 'POSTPONED' || 
                                   originalMatch.status === 'SUSPENDED' || 
                                   originalMatch.status === 'CANCELLED' 
                ? 'TIMED' 
                : originalMatch.status;
              expect(parsedMatch.status).toBe(expectedStatus);
              
              // Check season calculation
              const matchDate = new Date(originalMatch.utcDate);
              const year = matchDate.getFullYear();
              const month = matchDate.getMonth() + 1;
              const expectedSeason = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
              expect(parsedMatch.season).toBe(expectedSeason);
            }
            
            // Second call should return cached data with same consistency
            const secondResponse = await getCachedMatches();
            
            expect(secondResponse.error).toBeNull();
            expect(secondResponse.data).toBeDefined();
            expect(secondResponse.cached).toBe(true);
            
            // Verify cached data maintains consistency
            expect(secondResponse.data).toEqual(firstResponse.data);
            
            // Verify cache statistics
            const stats = getCacheStats();
            expect(stats.hits).toBeGreaterThan(0);
            expect(stats.size).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 2a: Cache invalidation maintains data consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mockFootballDataMatch(), { minLength: 1, maxLength: 3 }),
        fc.array(mockFootballDataMatch(), { minLength: 1, maxLength: 3 }),
        async (initialMatches, updatedMatches) => {
          // Clear cache and mocks for each test run
          clearCache();
          vi.clearAllMocks();
          
          // Parse initial matches
          const initialParsedMatches = initialMatches.map(match => {
            const matchDate = new Date(match.utcDate);
            const year = matchDate.getFullYear();
            const month = matchDate.getMonth() + 1;
            const season = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

            return {
              external_id: match.id.toString(),
              home_team: match.homeTeam.name,
              away_team: match.awayTeam.name,
              home_score: match.score.fullTime.home,
              away_score: match.score.fullTime.away,
              status: match.status === 'POSTPONED' || match.status === 'SUSPENDED' || match.status === 'CANCELLED' 
                ? 'TIMED' as const
                : match.status as 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED',
              kickoff_time: match.utcDate,
              gameweek: match.matchday,
              season,
            };
          });

          // Mock initial API response
          vi.mocked(getPremierLeagueMatches).mockResolvedValueOnce({
            data: initialParsedMatches,
            error: null,
            status: 200,
          });

          // Get initial cached data
          const initialResponse = await getCachedMatches();
          expect(initialResponse.error).toBeNull();
          expect(initialResponse.data).toEqual(initialParsedMatches);
          
          // Parse updated matches
          const updatedParsedMatches = updatedMatches.map(match => {
            const matchDate = new Date(match.utcDate);
            const year = matchDate.getFullYear();
            const month = matchDate.getMonth() + 1;
            const season = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

            return {
              external_id: match.id.toString(),
              home_team: match.homeTeam.name,
              away_team: match.awayTeam.name,
              home_score: match.score.fullTime.home,
              away_score: match.score.fullTime.away,
              status: match.status === 'POSTPONED' || match.status === 'SUSPENDED' || match.status === 'CANCELLED' 
                ? 'TIMED' as const
                : match.status as 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED',
              kickoff_time: match.utcDate,
              gameweek: match.matchday,
              season,
            };
          });

          // Mock updated API response
          vi.mocked(getPremierLeagueMatches).mockResolvedValueOnce({
            data: updatedParsedMatches,
            error: null,
            status: 200,
          });
          
          // Force refresh should get updated data
          const updatedResponse = await getCachedMatches(undefined, undefined, true);
          expect(updatedResponse.error).toBeNull();
          expect(updatedResponse.data).toEqual(updatedParsedMatches);
          
          // Verify data consistency is maintained after update
          if (updatedResponse.data) {
            for (let i = 0; i < updatedResponse.data.length; i++) {
              const parsedMatch = updatedResponse.data[i];
              const originalMatch = updatedMatches[i];
              
              // Verify field mapping consistency is maintained
              expect(parsedMatch.external_id).toBe(originalMatch.id.toString());
              expect(parsedMatch.home_team).toBe(originalMatch.homeTeam.name);
              expect(parsedMatch.away_team).toBe(originalMatch.awayTeam.name);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});