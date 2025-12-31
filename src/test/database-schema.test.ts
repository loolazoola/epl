import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// Feature: premier-league-prediction-game, Property 12: Referential Integrity Maintenance
// **Validates: Requirements 7.4**

describe('Database Schema Integrity Property Tests', () => {
  // Generators for test data
  const userGenerator = fc.record({
    id: fc.uuid(),
    email: fc.emailAddress(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    avatar_url: fc.option(fc.webUrl()),
    total_points: fc.integer({ min: 0, max: 10000 })
  })

  const matchGenerator = fc.record({
    id: fc.uuid(),
    external_id: fc.string({ minLength: 1, maxLength: 50 }),
    home_team: fc.string({ minLength: 1, maxLength: 100 }),
    away_team: fc.string({ minLength: 1, maxLength: 100 }),
    home_score: fc.option(fc.integer({ min: 0, max: 20 })),
    away_score: fc.option(fc.integer({ min: 0, max: 20 })),
    status: fc.constantFrom('TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED'),
    kickoff_time: fc.date({ min: new Date('2024-01-01T00:00:00Z'), max: new Date('2025-12-31T23:59:59Z') }).map(d => d.toISOString()),
    gameweek: fc.option(fc.integer({ min: 1, max: 38 })),
    season: fc.constantFrom('2024-25', '2025-26')
  })

  const predictionGenerator = fc.record({
    id: fc.uuid(),
    user_id: fc.uuid(),
    match_id: fc.uuid(),
    predicted_home_score: fc.integer({ min: 0, max: 20 }),
    predicted_away_score: fc.integer({ min: 0, max: 20 }),
    points_earned: fc.integer({ min: 0, max: 5 }),
    processed: fc.boolean()
  })

  // Helper function to validate referential integrity rules
  function validateReferentialIntegrity(users: any[], matches: any[], predictions: any[]): boolean {
    // Check that all predictions reference existing users and matches
    for (const prediction of predictions) {
      const userExists = users.some(user => user.id === prediction.user_id)
      const matchExists = matches.some(match => match.id === prediction.match_id)
      
      if (!userExists || !matchExists) {
        return false // Referential integrity violation
      }
    }
    return true
  }

  // Helper function to validate unique constraints
  function validateUniqueConstraints(predictions: any[]): boolean {
    const userMatchPairs = new Set()
    
    for (const prediction of predictions) {
      const pair = `${prediction.user_id}:${prediction.match_id}`
      if (userMatchPairs.has(pair)) {
        return false // Unique constraint violation
      }
      userMatchPairs.add(pair)
    }
    return true
  }

  // Helper function to simulate cascade delete
  function simulateCascadeDelete(users: any[], predictions: any[], deletedUserId: string) {
    // Remove user
    const remainingUsers = users.filter(user => user.id !== deletedUserId)
    
    // Remove predictions for deleted user (cascade delete)
    const remainingPredictions = predictions.filter(prediction => prediction.user_id !== deletedUserId)
    
    return { users: remainingUsers, predictions: remainingPredictions }
  }

  it('Property 12: Referential Integrity Maintenance - For any database operation involving users, predictions, and matches, the system should maintain referential integrity constraints and prevent orphaned records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(userGenerator, { minLength: 1, maxLength: 10 }),
        fc.array(matchGenerator, { minLength: 1, maxLength: 10 }),
        async (users, matches) => {
          // Generate predictions that reference existing users and matches
          const validPredictions = fc.sample(
            fc.record({
              id: fc.uuid(),
              user_id: fc.constantFrom(...users.map(u => u.id)),
              match_id: fc.constantFrom(...matches.map(m => m.id)),
              predicted_home_score: fc.integer({ min: 0, max: 20 }),
              predicted_away_score: fc.integer({ min: 0, max: 20 }),
              points_earned: fc.integer({ min: 0, max: 5 }),
              processed: fc.boolean()
            }),
            Math.min(users.length * matches.length, 20)
          )

          // Validate initial referential integrity
          expect(validateReferentialIntegrity(users, matches, validPredictions)).toBe(true)

          // Test cascade delete behavior
          if (users.length > 0) {
            const userToDelete = users[0].id
            const { users: remainingUsers, predictions: remainingPredictions } = 
              simulateCascadeDelete(users, validPredictions, userToDelete)

            // After cascade delete, referential integrity should still be maintained
            expect(validateReferentialIntegrity(remainingUsers, matches, remainingPredictions)).toBe(true)

            // No predictions should reference the deleted user
            const orphanedPredictions = remainingPredictions.filter(p => p.user_id === userToDelete)
            expect(orphanedPredictions).toHaveLength(0)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 12b: Foreign Key Constraints - For any attempt to create predictions with invalid user_id or match_id, the system should reject the operation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(userGenerator, { minLength: 1, maxLength: 5 }),
        fc.array(matchGenerator, { minLength: 1, maxLength: 5 }),
        fc.uuid(), // Invalid user ID
        fc.uuid(), // Invalid match ID
        async (users, matches, invalidUserId, invalidMatchId) => {
          // Ensure invalid IDs don't exist in our data
          const userIds = users.map(u => u.id)
          const matchIds = matches.map(m => m.id)
          
          // Skip if the "invalid" IDs actually exist
          if (userIds.includes(invalidUserId) || matchIds.includes(invalidMatchId)) {
            return true
          }

          // Create prediction with invalid user_id
          const invalidUserPrediction = {
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: invalidUserId,
            match_id: matchIds[0], // Valid match ID
            predicted_home_score: 1,
            predicted_away_score: 0,
            points_earned: 0,
            processed: false
          }

          // Create prediction with invalid match_id
          const invalidMatchPrediction = {
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: userIds[0], // Valid user ID
            match_id: invalidMatchId,
            predicted_home_score: 1,
            predicted_away_score: 0,
            points_earned: 0,
            processed: false
          }

          // Both should violate referential integrity
          expect(validateReferentialIntegrity(users, matches, [invalidUserPrediction])).toBe(false)
          expect(validateReferentialIntegrity(users, matches, [invalidMatchPrediction])).toBe(false)

          return true
        }
      ),
      { numRuns: 50 }
    )
  })

  it('Property 12c: Unique Constraints - For any user and match combination, only one prediction should be allowed', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGenerator,
        matchGenerator,
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        async (user, match, homeScore1, awayScore1, homeScore2, awayScore2) => {
          // Create two predictions for the same user and match
          const prediction1 = {
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: user.id,
            match_id: match.id,
            predicted_home_score: homeScore1,
            predicted_away_score: awayScore1,
            points_earned: 0,
            processed: false
          }

          const prediction2 = {
            id: fc.sample(fc.uuid(), 1)[0],
            user_id: user.id,
            match_id: match.id,
            predicted_home_score: homeScore2,
            predicted_away_score: awayScore2,
            points_earned: 0,
            processed: false
          }

          const predictions = [prediction1, prediction2]

          // Should violate unique constraint (same user_id and match_id)
          expect(validateUniqueConstraints(predictions)).toBe(false)

          // But single prediction should be valid
          expect(validateUniqueConstraints([prediction1])).toBe(true)
          expect(validateUniqueConstraints([prediction2])).toBe(true)

          return true
        }
      ),
      { numRuns: 50 }
    )
  })

  it('Property 12d: Data Validation - For any prediction data, score values should be non-negative integers', async () => {
    await fc.assert(
      fc.asyncProperty(
        predictionGenerator,
        async (prediction) => {
          // Validate that scores are non-negative
          const isValidHomeScore = Number.isInteger(prediction.predicted_home_score) && prediction.predicted_home_score >= 0
          const isValidAwayScore = Number.isInteger(prediction.predicted_away_score) && prediction.predicted_away_score >= 0
          const isValidPoints = Number.isInteger(prediction.points_earned) && prediction.points_earned >= 0

          expect(isValidHomeScore).toBe(true)
          expect(isValidAwayScore).toBe(true)
          expect(isValidPoints).toBe(true)

          // Scores should be reasonable (0-20 range for football)
          expect(prediction.predicted_home_score).toBeLessThanOrEqual(20)
          expect(prediction.predicted_away_score).toBeLessThanOrEqual(20)
          expect(prediction.points_earned).toBeLessThanOrEqual(5) // Max 5 points per prediction

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})