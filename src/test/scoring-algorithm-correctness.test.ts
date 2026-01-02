import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculatePoints, getMatchOutcome, validatePredictionScores } from '@/lib/scoring'

/**
 * Feature: premier-league-prediction-game, Property 6: Scoring Algorithm Correctness
 * **Validates: Requirements 4.2, 4.3, 4.4**
 */

describe('Scoring Algorithm Correctness', () => {
  // Generator for valid football scores (0-20)
  const scoreArbitrary = fc.integer({ min: 0, max: 20 })
  
  // Generator for match with scores
  const matchArbitrary = fc.record({
    home_score: scoreArbitrary,
    away_score: scoreArbitrary
  })
  
  // Generator for prediction
  const predictionArbitrary = fc.record({
    predicted_home_score: scoreArbitrary,
    predicted_away_score: scoreArbitrary
  })

  it('Property 6: For any finished match with predictions, the scoring system should award exactly 5 points for exact score matches, 2 points for correct outcome predictions, and 0 points for incorrect predictions', () => {
    fc.assert(
      fc.property(
        predictionArbitrary,
        matchArbitrary,
        (prediction, match) => {
          const result = calculatePoints(prediction, match)
          
          // Check exact score match
          if (prediction.predicted_home_score === match.home_score && 
              prediction.predicted_away_score === match.away_score) {
            expect(result.points).toBe(5)
            expect(result.reason).toBe('exact_score')
            return true
          }
          
          // Check outcome match
          const actualOutcome = getMatchOutcome(match.home_score, match.away_score)
          const predictedOutcome = getMatchOutcome(prediction.predicted_home_score, prediction.predicted_away_score)
          
          if (actualOutcome === predictedOutcome) {
            expect(result.points).toBe(2)
            expect(result.reason).toBe('correct_outcome')
            return true
          }
          
          // Should be incorrect
          expect(result.points).toBe(0)
          expect(result.reason).toBe('incorrect')
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6a: Exact score predictions always award 5 points', () => {
    fc.assert(
      fc.property(
        scoreArbitrary,
        scoreArbitrary,
        (homeScore, awayScore) => {
          const prediction = {
            predicted_home_score: homeScore,
            predicted_away_score: awayScore
          }
          const match = {
            home_score: homeScore,
            away_score: awayScore
          }
          
          const result = calculatePoints(prediction, match)
          expect(result.points).toBe(5)
          expect(result.reason).toBe('exact_score')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6b: Correct outcome but wrong score always awards 2 points', () => {
    fc.assert(
      fc.property(
        scoreArbitrary,
        scoreArbitrary,
        fc.integer({ min: 1, max: 5 }), // offset to ensure different scores but same outcome
        (homeScore, awayScore, offset) => {
          // Create a prediction with same outcome but different scores
          let predictedHome, predictedAway
          
          if (homeScore > awayScore) {
            // Home win - predict different home win
            predictedHome = homeScore + offset
            predictedAway = awayScore
          } else if (awayScore > homeScore) {
            // Away win - predict different away win  
            predictedHome = homeScore
            predictedAway = awayScore + offset
          } else {
            // Draw - predict different draw
            predictedHome = homeScore + offset
            predictedAway = awayScore + offset
          }
          
          // Ensure scores are within valid range
          if (predictedHome > 20 || predictedAway > 20) {
            return true // Skip this test case
          }
          
          const prediction = {
            predicted_home_score: predictedHome,
            predicted_away_score: predictedAway
          }
          const match = {
            home_score: homeScore,
            away_score: awayScore
          }
          
          // Skip if this creates an exact match
          if (predictedHome === homeScore && predictedAway === awayScore) {
            return true
          }
          
          const result = calculatePoints(prediction, match)
          expect(result.points).toBe(2)
          expect(result.reason).toBe('correct_outcome')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6c: Wrong outcome predictions always award 0 points', () => {
    fc.assert(
      fc.property(
        scoreArbitrary,
        scoreArbitrary,
        scoreArbitrary,
        scoreArbitrary,
        (actualHome, actualAway, predictedHome, predictedAway) => {
          const actualOutcome = getMatchOutcome(actualHome, actualAway)
          const predictedOutcome = getMatchOutcome(predictedHome, predictedAway)
          
          // Only test cases where outcomes are different
          if (actualOutcome === predictedOutcome) {
            return true // Skip this test case
          }
          
          const prediction = {
            predicted_home_score: predictedHome,
            predicted_away_score: predictedAway
          }
          const match = {
            home_score: actualHome,
            away_score: actualAway
          }
          
          const result = calculatePoints(prediction, match)
          expect(result.points).toBe(0)
          expect(result.reason).toBe('incorrect')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6d: Match outcome determination is consistent', () => {
    fc.assert(
      fc.property(
        scoreArbitrary,
        scoreArbitrary,
        (homeScore, awayScore) => {
          const outcome = getMatchOutcome(homeScore, awayScore)
          
          if (homeScore > awayScore) {
            expect(outcome).toBe('home_win')
          } else if (awayScore > homeScore) {
            expect(outcome).toBe('away_win')
          } else {
            expect(outcome).toBe('draw')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6e: Score validation works correctly', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        (homeScore, awayScore) => {
          const isValid = validatePredictionScores(homeScore, awayScore)
          
          const expectedValid = Number.isInteger(homeScore) && 
                               Number.isInteger(awayScore) && 
                               homeScore >= 0 && 
                               homeScore <= 20 && 
                               awayScore >= 0 && 
                               awayScore <= 20
          
          expect(isValid).toBe(expectedValid)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6f: Points are always non-negative integers', () => {
    fc.assert(
      fc.property(
        predictionArbitrary,
        matchArbitrary,
        (prediction, match) => {
          const result = calculatePoints(prediction, match)
          
          expect(Number.isInteger(result.points)).toBe(true)
          expect(result.points).toBeGreaterThanOrEqual(0)
          expect([0, 2, 5]).toContain(result.points)
        }
      ),
      { numRuns: 100 }
    )
  })
})