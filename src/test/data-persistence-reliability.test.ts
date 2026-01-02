import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: premier-league-prediction-game, Property 11: Data Persistence Reliability
 * **Validates: Requirements 7.1, 7.2**
 */

describe('Data Persistence Reliability', () => {
  // Check if we have the required environment variables for database tests
  const hasSupabaseConfig = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                           process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && 
                           process.env.SUPABASE_SERVICE_ROLE_KEY

  beforeAll(() => {
    if (!hasSupabaseConfig) {
      console.warn('Skipping database tests - Supabase environment variables not configured')
    }
  })

  // Only run tests if we have proper configuration
  const testIf = hasSupabaseConfig ? it : it.skip

  let testUsers: any[] = []
  let testMatches: any[] = []
  let testPredictions: any[] = []

  // Lazy load modules to avoid import errors when env vars are missing
  let atomicScoreProcessing: any
  let atomicUserCreation: any
  let atomicPredictionSubmission: any
  let userOperations: any
  let matchOperations: any
  let predictionOperations: any
  let createServerClient: any

  beforeEach(async () => {
    if (!hasSupabaseConfig) return

    // Dynamically import modules only when needed
    const transactions = await import('@/lib/transactions')
    const database = await import('@/lib/database')
    const supabase = await import('@/lib/supabase')

    atomicScoreProcessing = transactions.atomicScoreProcessing
    atomicUserCreation = transactions.atomicUserCreation
    atomicPredictionSubmission = transactions.atomicPredictionSubmission
    userOperations = database.userOperations
    matchOperations = database.matchOperations
    predictionOperations = database.predictionOperations
    createServerClient = supabase.createServerClient
  })

  // Clean up test data after each test
  afterEach(async () => {
    if (!hasSupabaseConfig || !createServerClient) return

    const supabase = createServerClient()
    
    // Clean up in reverse order of dependencies
    if (testPredictions.length > 0) {
      await supabase.from('predictions').delete().in('id', testPredictions.map(p => p.id))
      testPredictions = []
    }
    
    if (testMatches.length > 0) {
      await supabase.from('matches').delete().in('id', testMatches.map(m => m.id))
      testMatches = []
    }
    
    if (testUsers.length > 0) {
      await supabase.from('users').delete().in('id', testUsers.map(u => u.id))
      testUsers = []
    }
  })

  // Generators for test data
  const emailArbitrary = fc.string({ minLength: 5, maxLength: 50 }).map(s => `${s}@test.com`)
  const nameArbitrary = fc.string({ minLength: 2, maxLength: 50 }).filter(s => /^[a-zA-Z\s]+$/.test(s))
  const scoreArbitrary = fc.integer({ min: 0, max: 20 })
  const teamNameArbitrary = fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z\s]+$/.test(s))
  
  const userDataArbitrary = fc.record({
    email: emailArbitrary,
    name: nameArbitrary,
    avatar_url: fc.option(fc.webUrl(), { nil: undefined })
  })

  const matchDataArbitrary = fc.record({
    external_id: fc.string({ minLength: 1, maxLength: 20 }),
    home_team: teamNameArbitrary,
    away_team: teamNameArbitrary,
    status: fc.constantFrom('TIMED', 'FINISHED'),
    kickoff_time: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
    gameweek: fc.integer({ min: 1, max: 38 }),
    season: fc.constantFrom('2024', '2025')
  }).filter(match => match.home_team !== match.away_team)

  testIf('Property 11a: User creation is atomic - either succeeds completely or fails completely', () => {
    fc.assert(
      fc.property(
        userDataArbitrary,
        async (userData) => {
          const result = await atomicUserCreation(userData)
          
          if (result.success) {
            // If successful, user should exist in database
            expect(result.data).toBeDefined()
            expect(result.data.email).toBe(userData.email)
            expect(result.data.name).toBe(userData.name)
            expect(result.data.total_points).toBe(0)
            
            // Track for cleanup
            testUsers.push(result.data)
            
            // Verify user exists in database
            const dbUser = await userOperations.getById(result.data.id)
            expect(dbUser).toBeDefined()
            expect(dbUser!.email).toBe(userData.email)
          } else {
            // If failed, user should not exist in database
            expect(result.error).toBeDefined()
            
            // Try to find user by email - should not exist
            const dbUser = await userOperations.getByEmail(userData.email)
            expect(dbUser).toBeNull()
          }
        }
      ),
      { numRuns: 20 } // Reduced runs for database operations
    )
  })

  testIf('Property 11b: Prediction submission is atomic with proper validation', () => {
    fc.assert(
      fc.property(
        userDataArbitrary,
        matchDataArbitrary,
        scoreArbitrary,
        scoreArbitrary,
        async (userData, matchData, homeScore, awayScore) => {
          // Create test user first
          const userResult = await atomicUserCreation(userData)
          if (!userResult.success) return true // Skip if user creation fails
          testUsers.push(userResult.data)

          // Create test match
          const supabase = createServerClient()
          const matchInsert = {
            ...matchData,
            kickoff_time: matchData.kickoff_time.toISOString(),
            home_score: matchData.status === 'FINISHED' ? homeScore : null,
            away_score: matchData.status === 'FINISHED' ? awayScore : null
          }
          
          const { data: match, error: matchError } = await (supabase as any)
            .from('matches')
            .insert(matchInsert)
            .select()
            .single()
          
          if (matchError) return true // Skip if match creation fails
          testMatches.push(match)

          // Test prediction submission
          const predictionData = {
            userId: userResult.data.id,
            matchId: match.id,
            predictedHomeScore: homeScore,
            predictedAwayScore: awayScore
          }

          const result = await atomicPredictionSubmission(predictionData)
          
          if (result.success) {
            // If successful, prediction should exist in database
            expect(result.data).toBeDefined()
            expect(result.data.user_id).toBe(userResult.data.id)
            expect(result.data.match_id).toBe(match.id)
            expect(result.data.predicted_home_score).toBe(homeScore)
            expect(result.data.predicted_away_score).toBe(awayScore)
            expect(result.data.processed).toBe(false)
            
            testPredictions.push(result.data)
            
            // Verify prediction exists in database
            const dbPrediction = await predictionOperations.getByUserAndMatch(userResult.data.id, match.id)
            expect(dbPrediction).toBeDefined()
            expect(dbPrediction!.predicted_home_score).toBe(homeScore)
            expect(dbPrediction!.predicted_away_score).toBe(awayScore)
          } else {
            // If failed, prediction should not exist in database
            expect(result.error).toBeDefined()
            
            const dbPrediction = await predictionOperations.getByUserAndMatch(userResult.data.id, match.id)
            expect(dbPrediction).toBeNull()
          }
        }
      ),
      { numRuns: 15 } // Reduced runs for complex database operations
    )
  })

  testIf('Property 11c: Score processing is atomic - all predictions processed or none', () => {
    fc.assert(
      fc.property(
        fc.array(userDataArbitrary, { minLength: 1, maxLength: 5 }),
        matchDataArbitrary,
        scoreArbitrary,
        scoreArbitrary,
        scoreArbitrary,
        scoreArbitrary,
        async (usersData, matchData, actualHome, actualAway, predHome, predAway) => {
          const supabase = createServerClient()
          
          // Create test users
          const users = []
          for (const userData of usersData) {
            const userResult = await atomicUserCreation(userData)
            if (!userResult.success) return true // Skip if user creation fails
            users.push(userResult.data)
            testUsers.push(userResult.data)
          }

          // Create finished match with scores
          const matchInsert = {
            ...matchData,
            status: 'FINISHED' as const,
            kickoff_time: new Date(Date.now() - 86400000).toISOString(), // Yesterday
            home_score: actualHome,
            away_score: actualAway
          }
          
          const { data: match, error: matchError } = await (supabase as any)
            .from('matches')
            .insert(matchInsert)
            .select()
            .single()
          
          if (matchError) return true // Skip if match creation fails
          testMatches.push(match)

          // Create predictions for all users
          const predictions = []
          for (const user of users) {
            const { data: prediction, error: predError } = await (supabase as any)
              .from('predictions')
              .insert({
                user_id: user.id,
                match_id: match.id,
                predicted_home_score: predHome,
                predicted_away_score: predAway,
                points_earned: 0,
                processed: false
              })
              .select()
              .single()
            
            if (predError) return true // Skip if prediction creation fails
            predictions.push(prediction)
            testPredictions.push(prediction)
          }

          // Get initial user points
          const initialPoints = new Map()
          for (const user of users) {
            const dbUser = await userOperations.getById(user.id)
            initialPoints.set(user.id, dbUser!.total_points)
          }

          // Process scores atomically
          const result = await atomicScoreProcessing(match.id, actualHome, actualAway)
          
          if (result.success && result.data) {
            // All predictions should be processed
            expect(result.data.processedPredictions).toBe(predictions.length)
            
            // Verify all predictions are marked as processed
            for (const prediction of predictions) {
              const dbPrediction = await predictionOperations.getByUserAndMatch(prediction.user_id, match.id)
              expect(dbPrediction!.processed).toBe(true)
              expect(dbPrediction!.points_earned).toBeGreaterThanOrEqual(0)
            }
            
            // Verify user points are updated correctly
            let totalPointsAwarded = 0
            for (const user of users) {
              const dbUser = await userOperations.getById(user.id)
              const pointsGained = dbUser!.total_points - initialPoints.get(user.id)
              expect(pointsGained).toBeGreaterThanOrEqual(0)
              totalPointsAwarded += pointsGained
            }
            
            expect(totalPointsAwarded).toBe(result.data.totalPointsAwarded)
          } else {
            // If processing failed, no predictions should be processed
            for (const prediction of predictions) {
              const dbPrediction = await predictionOperations.getByUserAndMatch(prediction.user_id, match.id)
              expect(dbPrediction!.processed).toBe(false)
              expect(dbPrediction!.points_earned).toBe(0)
            }
            
            // User points should remain unchanged
            for (const user of users) {
              const dbUser = await userOperations.getById(user.id)
              expect(dbUser!.total_points).toBe(initialPoints.get(user.id))
            }
          }
        }
      ),
      { numRuns: 10 } // Reduced runs for very complex operations
    )
  })

  testIf('Property 11d: Database operations maintain referential integrity', () => {
    fc.assert(
      fc.property(
        userDataArbitrary,
        matchDataArbitrary,
        scoreArbitrary,
        scoreArbitrary,
        async (userData, matchData, homeScore, awayScore) => {
          const supabase = createServerClient()
          
          // Create user and match
          const userResult = await atomicUserCreation(userData)
          if (!userResult.success) return true
          testUsers.push(userResult.data)

          const matchInsert = {
            ...matchData,
            kickoff_time: matchData.kickoff_time.toISOString(),
            home_score: matchData.status === 'FINISHED' ? homeScore : null,
            away_score: matchData.status === 'FINISHED' ? awayScore : null
          }
          
          const { data: match, error: matchError } = await (supabase as any)
            .from('matches')
            .insert(matchInsert)
            .select()
            .single()
          
          if (matchError) return true
          testMatches.push(match)

          // Create prediction
          const { data: prediction, error: predError } = await (supabase as any)
            .from('predictions')
            .insert({
              user_id: userResult.data.id,
              match_id: match.id,
              predicted_home_score: homeScore,
              predicted_away_score: awayScore,
              points_earned: 0,
              processed: false
            })
            .select()
            .single()
          
          if (predError) return true
          testPredictions.push(prediction)

          // Verify referential integrity
          // 1. Prediction references valid user
          const dbUser = await userOperations.getById(prediction.user_id)
          expect(dbUser).toBeDefined()
          expect(dbUser!.id).toBe(userResult.data.id)

          // 2. Prediction references valid match
          const dbMatch = await matchOperations.getById(prediction.match_id)
          expect(dbMatch).toBeDefined()
          expect(dbMatch!.id).toBe(match.id)

          // 3. User-match combination is unique
          const duplicatePrediction = await atomicPredictionSubmission({
            userId: userResult.data.id,
            matchId: match.id,
            predictedHomeScore: homeScore + 1,
            predictedAwayScore: awayScore + 1
          })
          expect(duplicatePrediction.success).toBe(false)
          expect(duplicatePrediction.error).toContain('already exists')
        }
      ),
      { numRuns: 10 }
    )
  })

  testIf('Property 11e: Data validation prevents invalid data persistence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 30 }), // Include invalid scores
        fc.integer({ min: -10, max: 30 }),
        async (homeScore, awayScore) => {
          // Create valid user and match first
          const userData = {
            email: 'test@example.com',
            name: 'Test User'
          }
          
          const userResult = await atomicUserCreation(userData)
          if (!userResult.success) return true
          testUsers.push(userResult.data)

          const supabase = createServerClient()
          const matchInsert = {
            external_id: 'test-match',
            home_team: 'Team A',
            away_team: 'Team B',
            status: 'TIMED' as const,
            kickoff_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            gameweek: 1,
            season: '2024'
          }
          
          const { data: match, error: matchError } = await (supabase as any)
            .from('matches')
            .insert(matchInsert)
            .select()
            .single()
          
          if (matchError) return true
          testMatches.push(match)

          // Test prediction with potentially invalid scores
          const result = await atomicPredictionSubmission({
            userId: userResult.data.id,
            matchId: match.id,
            predictedHomeScore: homeScore,
            predictedAwayScore: awayScore
          })

          const isValidScore = homeScore >= 0 && homeScore <= 20 && awayScore >= 0 && awayScore <= 20

          if (isValidScore) {
            // Valid scores should succeed
            expect(result.success).toBe(true)
            if (result.success) {
              testPredictions.push(result.data)
            }
          } else {
            // Invalid scores should fail
            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
            
            // Verify no prediction was created
            const dbPrediction = await predictionOperations.getByUserAndMatch(userResult.data.id, match.id)
            expect(dbPrediction).toBeNull()
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  testIf('Property 11f: Concurrent operations maintain data consistency', () => {
    fc.assert(
      fc.property(
        fc.array(userDataArbitrary, { minLength: 2, maxLength: 3 }),
        matchDataArbitrary,
        scoreArbitrary,
        scoreArbitrary,
        async (usersData, matchData, homeScore, awayScore) => {
          const supabase = createServerClient()
          
          // Create users concurrently
          const userPromises = usersData.map(userData => atomicUserCreation(userData))
          const userResults = await Promise.all(userPromises)
          
          const successfulUsers = userResults.filter(r => r.success).map(r => r.data)
          if (successfulUsers.length === 0) return true
          
          testUsers.push(...successfulUsers)

          // Create match
          const matchInsert = {
            ...matchData,
            kickoff_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            home_score: null,
            away_score: null,
            status: 'TIMED' as const
          }
          
          const { data: match, error: matchError } = await (supabase as any)
            .from('matches')
            .insert(matchInsert)
            .select()
            .single()
          
          if (matchError) return true
          testMatches.push(match)

          // Submit predictions concurrently
          const predictionPromises = successfulUsers.map(user => 
            atomicPredictionSubmission({
              userId: user.id,
              matchId: match.id,
              predictedHomeScore: homeScore,
              predictedAwayScore: awayScore
            })
          )
          
          const predictionResults = await Promise.all(predictionPromises)
          
          // All predictions should succeed (no conflicts)
          const successfulPredictions = predictionResults.filter(r => r.success)
          expect(successfulPredictions.length).toBe(successfulUsers.length)
          
          testPredictions.push(...successfulPredictions.map(r => r.data))
          
          // Verify each user has exactly one prediction for this match
          for (const user of successfulUsers) {
            const userPredictions = await predictionOperations.getByUserId(user.id)
            const matchPredictions = userPredictions.filter(p => p.match_id === match.id)
            expect(matchPredictions.length).toBe(1)
          }
        }
      ),
      { numRuns: 8 } // Reduced for concurrent operations
    )
  })
})