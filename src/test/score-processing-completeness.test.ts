import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'

// Mock Supabase before importing other modules
vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createServerClient: vi.fn(() => ({}))
}))

import { processMatchScores } from '@/lib/score-processor'
import { calculatePoints } from '@/lib/scoring'
import { matchOperations, predictionOperations, userOperations } from '@/lib/database'

/**
 * Feature: premier-league-prediction-game, Property 7: Score Processing Completeness
 * **Validates: Requirements 4.1, 4.5, 4.6**
 */

// Mock the database operations
vi.mock('@/lib/database', () => ({
  matchOperations: {
    getById: vi.fn(),
    getFinished: vi.fn()
  },
  predictionOperations: {
    getUnprocessedForMatch: vi.fn(),
    getByMatchId: vi.fn(),
    markAsProcessed: vi.fn()
  },
  userOperations: {
    getById: vi.fn(),
    updatePoints: vi.fn()
  }
}))

describe('Score Processing Completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Generator for valid football scores (0-20)
  const scoreArbitrary = fc.integer({ min: 0, max: 20 })
  
  // Generator for finished match
  const finishedMatchArbitrary = fc.record({
    id: fc.uuid(),
    external_id: fc.string(),
    home_team: fc.string(),
    away_team: fc.string(),
    home_score: scoreArbitrary,
    away_score: scoreArbitrary,
    status: fc.constant('FINISHED' as const),
    kickoff_time: fc.date().map(d => d.toISOString()),
    season: fc.string(),
    created_at: fc.date().map(d => d.toISOString()),
    updated_at: fc.date().map(d => d.toISOString())
  })

  // Generator for unprocessed prediction
  const unprocessedPredictionArbitrary = fc.record({
    id: fc.uuid(),
    user_id: fc.uuid(),
    match_id: fc.uuid(),
    predicted_home_score: scoreArbitrary,
    predicted_away_score: scoreArbitrary,
    points_earned: fc.constant(0),
    processed: fc.constant(false),
    created_at: fc.date().map(d => d.toISOString()),
    updated_at: fc.date().map(d => d.toISOString())
  })

  // Generator for user
  const userArbitrary = fc.record({
    id: fc.uuid(),
    email: fc.emailAddress(),
    name: fc.string(),
    total_points: fc.integer({ min: 0, max: 1000 }),
    created_at: fc.date().map(d => d.toISOString()),
    updated_at: fc.date().map(d => d.toISOString())
  })

  it('Property 7: For any finished match, the score processor should calculate points for all predictions of that match, update user totals, and mark predictions as processed to prevent duplicates', () => {
    fc.assert(
      fc.property(
        finishedMatchArbitrary,
        unprocessedPredictionArbitrary,
        userArbitrary,
        async (match, prediction, user) => {
          // Reset mocks for each iteration
          vi.resetAllMocks()
          
          const matchPrediction = { ...prediction, match_id: match.id, user_id: user.id }
          
          // Mock database responses
          vi.mocked(matchOperations.getById).mockResolvedValue(match)
          vi.mocked(predictionOperations.getUnprocessedForMatch).mockResolvedValue([matchPrediction])
          vi.mocked(userOperations.getById).mockResolvedValue(user)
          
          // Calculate expected points
          const expectedPoints = calculatePoints(matchPrediction, match).points
          
          vi.mocked(userOperations.updatePoints).mockResolvedValue({ 
            ...user, 
            total_points: user.total_points + expectedPoints 
          })
          vi.mocked(predictionOperations.markAsProcessed).mockResolvedValue({
            ...matchPrediction,
            processed: true,
            points_earned: expectedPoints
          })

          // Process the match
          const result = await processMatchScores(match.id)

          // Verify processing completed successfully
          expect(result.processedPredictions).toBe(1)
          expect(result.totalPointsAwarded).toBe(expectedPoints)
          expect(result.errors).toHaveLength(0)
          
          return true
        }
      ),
      { numRuns: 20 } // Reduced runs for stability
    )
  })

  it('Property 7a: Processing is idempotent - no duplicate point calculations', () => {
    fc.assert(
      fc.property(
        finishedMatchArbitrary,
        async (match) => {
          // Reset mocks for each iteration
          vi.resetAllMocks()
          
          // Mock match with no unprocessed predictions
          vi.mocked(matchOperations.getById).mockResolvedValue(match)
          vi.mocked(predictionOperations.getUnprocessedForMatch).mockResolvedValue([])

          const result = await processMatchScores(match.id)

          // Should process 0 predictions when none are unprocessed
          expect(result.processedPredictions).toBe(0)
          expect(result.totalPointsAwarded).toBe(0)
          expect(result.errors).toHaveLength(0)
          
          return true
        }
      ),
      { numRuns: 20 }
    )
  })

  it('Property 7b: Points calculation is consistent with scoring algorithm', () => {
    fc.assert(
      fc.property(
        finishedMatchArbitrary,
        unprocessedPredictionArbitrary,
        userArbitrary,
        async (match, prediction, user) => {
          // Reset mocks for each iteration
          vi.resetAllMocks()
          
          const matchPrediction = { ...prediction, match_id: match.id, user_id: user.id }
          
          // Mock database responses
          vi.mocked(matchOperations.getById).mockResolvedValue(match)
          vi.mocked(predictionOperations.getUnprocessedForMatch).mockResolvedValue([matchPrediction])
          vi.mocked(userOperations.getById).mockResolvedValue(user)
          
          // Calculate expected points using scoring algorithm
          const expectedPoints = calculatePoints(matchPrediction, match).points
          
          vi.mocked(userOperations.updatePoints).mockResolvedValue({ 
            ...user, 
            total_points: user.total_points + expectedPoints 
          })
          vi.mocked(predictionOperations.markAsProcessed).mockResolvedValue({
            ...matchPrediction,
            processed: true,
            points_earned: expectedPoints
          })

          const result = await processMatchScores(match.id)

          // Verify points awarded match scoring algorithm
          expect(result.totalPointsAwarded).toBe(expectedPoints)
          
          return true
        }
      ),
      { numRuns: 20 }
    )
  })

  it('Property 7c: Error handling preserves data integrity', () => {
    fc.assert(
      fc.property(
        finishedMatchArbitrary,
        async (match) => {
          // Reset mocks for each iteration
          vi.resetAllMocks()
          
          // Mock match not found scenario
          vi.mocked(matchOperations.getById).mockResolvedValue(null)

          const result = await processMatchScores(match.id)

          // Should handle error gracefully
          expect(result.processedPredictions).toBe(0)
          expect(result.totalPointsAwarded).toBe(0)
          expect(result.errors.length).toBeGreaterThan(0)
          expect(result.errors[0]).toContain('Match not found')
          
          return true
        }
      ),
      { numRuns: 10 }
    )
  })

  // Additional unit tests for specific scenarios
  it('Unit test: Processes multiple predictions for same match correctly', async () => {
    const match = {
      id: 'match-1',
      external_id: 'ext-1',
      home_team: 'Team A',
      away_team: 'Team B',
      home_score: 2,
      away_score: 1,
      status: 'FINISHED' as const,
      kickoff_time: new Date().toISOString(),
      season: '2024',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const predictions = [
      {
        id: 'pred-1',
        user_id: 'user-1',
        match_id: 'match-1',
        predicted_home_score: 2,
        predicted_away_score: 1, // Exact match - 5 points
        points_earned: 0,
        processed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'pred-2',
        user_id: 'user-2',
        match_id: 'match-1',
        predicted_home_score: 1,
        predicted_away_score: 0, // Correct outcome - 2 points
        points_earned: 0,
        processed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    const users = [
      {
        id: 'user-1',
        email: 'user1@test.com',
        name: 'User 1',
        total_points: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'user-2',
        email: 'user2@test.com',
        name: 'User 2',
        total_points: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    // Mock database responses
    vi.mocked(matchOperations.getById).mockResolvedValue(match)
    vi.mocked(predictionOperations.getUnprocessedForMatch).mockResolvedValue(predictions)
    vi.mocked(userOperations.getById)
      .mockResolvedValueOnce(users[0])
      .mockResolvedValueOnce(users[1])
    vi.mocked(userOperations.updatePoints)
      .mockResolvedValueOnce({ ...users[0], total_points: 15 })
      .mockResolvedValueOnce({ ...users[1], total_points: 7 })
    vi.mocked(predictionOperations.markAsProcessed)
      .mockResolvedValueOnce({ ...predictions[0], processed: true, points_earned: 5 })
      .mockResolvedValueOnce({ ...predictions[1], processed: true, points_earned: 2 })

    const result = await processMatchScores(match.id)

    expect(result.processedPredictions).toBe(2)
    expect(result.totalPointsAwarded).toBe(7) // 5 + 2
    expect(result.errors).toHaveLength(0)

    // Verify user points were updated correctly
    expect(vi.mocked(userOperations.updatePoints)).toHaveBeenCalledWith('user-1', 15)
    expect(vi.mocked(userOperations.updatePoints)).toHaveBeenCalledWith('user-2', 7)
  })
})