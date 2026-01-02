/**
 * Property-Based Test for Prediction Storage and Updates
 * Feature: premier-league-prediction-game, Property 5: Prediction Storage and Updates
 * Validates: Requirements 3.3, 3.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/predictions/route'
import { PUT } from '@/app/api/predictions/[id]/route'

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}))

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          eq: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    }))
  }
}))

// Mock auth options
vi.mock('@/lib/auth', () => ({
  authOptions: {}
}))

import { getServerSession } from 'next-auth'
import { supabase } from '@/lib/supabase'

const mockGetServerSession = getServerSession as any
const mockSupabase = supabase as any

describe('Property 5: Prediction Storage and Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property 5: Prediction Storage and Updates
   * For any valid prediction submission, the system should store the predicted scores 
   * and allow updates before match start, while preventing modifications after the match begins.
   * Validates: Requirements 3.3, 3.5
   */
  it('should store valid predictions with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid prediction data
        fc.record({
          predictedHomeScore: fc.integer({ min: 0, max: 20 }),
          predictedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid(),
          predictionId: fc.uuid(),
          userEmail: fc.emailAddress()
        }),
        async ({ predictedHomeScore, predictedAwayScore, matchId, userId, predictionId, userEmail }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: userEmail }
          })

          // Mock user lookup
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: userId },
                      error: null
                    })
                  })
                })
              }
            }
            if (table === 'matches') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: matchId,
                        status: 'TIMED',
                        kickoff_time: new Date(Date.now() + 86400000).toISOString() // Future date
                      },
                      error: null
                    })
                  })
                })
              }
            }
            if (table === 'predictions') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: null,
                        error: { code: 'PGRST116' } // No existing prediction
                      })
                    })
                  })
                }),
                insert: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: predictionId,
                        user_id: userId,
                        match_id: matchId,
                        predicted_home_score: predictedHomeScore,
                        predicted_away_score: predictedAwayScore,
                        points_earned: 0,
                        processed: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      },
                      error: null
                    })
                  })
                })
              }
            }
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: userId },
                    error: null
                  })
                })
              })
            }
          })

          // Create request
          const request = new NextRequest('http://localhost:3000/api/predictions', {
            method: 'POST',
            body: JSON.stringify({
              match_id: matchId,
              predicted_home_score: predictedHomeScore,
              predicted_away_score: predictedAwayScore
            })
          })

          // Call API
          const response = await POST(request)
          const result = await response.json()

          // Verify successful storage
          expect(response.status).toBe(201)
          expect(result.success).toBe(true)
          expect(result.data).toBeDefined()
          expect(result.data.id).toBe(predictionId)
          expect(result.data.user_id).toBe(userId)
          expect(result.data.match_id).toBe(matchId)
          expect(result.data.predicted_home_score).toBe(predictedHomeScore)
          expect(result.data.predicted_away_score).toBe(predictedAwayScore)
          expect(result.data.points_earned).toBe(0)
          expect(result.data.processed).toBe(false)
          expect(result.data.created_at).toBeDefined()
          expect(result.data.updated_at).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should allow updates to predictions before match starts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate update data for valid predictions
        fc.record({
          originalHomeScore: fc.integer({ min: 0, max: 20 }),
          originalAwayScore: fc.integer({ min: 0, max: 20 }),
          updatedHomeScore: fc.integer({ min: 0, max: 20 }),
          updatedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid(),
          predictionId: fc.uuid(),
          userEmail: fc.emailAddress()
        }),
        async ({ 
          originalHomeScore, 
          originalAwayScore, 
          updatedHomeScore, 
          updatedAwayScore, 
          matchId, 
          userId, 
          predictionId, 
          userEmail 
        }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: userEmail }
          })

          // Mock user lookup
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: userId },
                      error: null
                    })
                  })
                })
              }
            }
            if (table === 'predictions') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: {
                          id: predictionId,
                          user_id: userId,
                          match_id: matchId,
                          predicted_home_score: originalHomeScore,
                          predicted_away_score: originalAwayScore,
                          processed: false,
                          match: {
                            id: matchId,
                            status: 'TIMED',
                            kickoff_time: new Date(Date.now() + 86400000).toISOString() // Future date
                          }
                        },
                        error: null
                      })
                    })
                  })
                }),
                update: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                          data: {
                            id: predictionId,
                            user_id: userId,
                            match_id: matchId,
                            predicted_home_score: updatedHomeScore,
                            predicted_away_score: updatedAwayScore,
                            points_earned: 0,
                            processed: false,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                          },
                          error: null
                        })
                      })
                    })
                  })
                })
              }
            }
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: userId },
                    error: null
                  })
                })
              })
            }
          })

          // Create update request
          const request = new NextRequest(`http://localhost:3000/api/predictions/${predictionId}`, {
            method: 'PUT',
            body: JSON.stringify({
              predicted_home_score: updatedHomeScore,
              predicted_away_score: updatedAwayScore
            })
          })

          // Call API
          const response = await PUT(request, { params: { id: predictionId } })
          const result = await response.json()

          // Verify successful update
          expect(response.status).toBe(200)
          expect(result.success).toBe(true)
          expect(result.data).toBeDefined()
          expect(result.data.id).toBe(predictionId)
          expect(result.data.predicted_home_score).toBe(updatedHomeScore)
          expect(result.data.predicted_away_score).toBe(updatedAwayScore)
          expect(result.data.updated_at).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should prevent duplicate predictions for the same match', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate data for duplicate prediction attempt
        fc.record({
          predictedHomeScore: fc.integer({ min: 0, max: 20 }),
          predictedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid(),
          existingPredictionId: fc.uuid(),
          userEmail: fc.emailAddress()
        }),
        async ({ predictedHomeScore, predictedAwayScore, matchId, userId, existingPredictionId, userEmail }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: userEmail }
          })

          // Mock user lookup
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: userId },
                      error: null
                    })
                  })
                })
              }
            }
            if (table === 'matches') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: matchId,
                        status: 'TIMED',
                        kickoff_time: new Date(Date.now() + 86400000).toISOString() // Future date
                      },
                      error: null
                    })
                  })
                })
              }
            }
            if (table === 'predictions') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: { id: existingPredictionId }, // Existing prediction found
                        error: null
                      })
                    })
                  })
                })
              }
            }
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: userId },
                    error: null
                  })
                })
              })
            }
          })

          // Create request
          const request = new NextRequest('http://localhost:3000/api/predictions', {
            method: 'POST',
            body: JSON.stringify({
              match_id: matchId,
              predicted_home_score: predictedHomeScore,
              predicted_away_score: predictedAwayScore
            })
          })

          // Call API
          const response = await POST(request)
          const result = await response.json()

          // Verify rejection of duplicate
          expect(response.status).toBe(409)
          expect(result.success).toBe(false)
          expect(result.error).toContain('Prediction already exists for this match')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should prevent updates to processed predictions', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate data for processed prediction update attempt
        fc.record({
          originalHomeScore: fc.integer({ min: 0, max: 20 }),
          originalAwayScore: fc.integer({ min: 0, max: 20 }),
          updatedHomeScore: fc.integer({ min: 0, max: 20 }),
          updatedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid(),
          predictionId: fc.uuid(),
          userEmail: fc.emailAddress()
        }),
        async ({ 
          originalHomeScore, 
          originalAwayScore, 
          updatedHomeScore, 
          updatedAwayScore, 
          matchId, 
          userId, 
          predictionId, 
          userEmail 
        }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: userEmail }
          })

          // Mock user lookup
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: userId },
                      error: null
                    })
                  })
                })
              }
            }
            if (table === 'predictions') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: {
                          id: predictionId,
                          user_id: userId,
                          match_id: matchId,
                          predicted_home_score: originalHomeScore,
                          predicted_away_score: originalAwayScore,
                          processed: true, // Already processed
                          match: {
                            id: matchId,
                            status: 'TIMED',
                            kickoff_time: new Date(Date.now() + 86400000).toISOString() // Future date
                          }
                        },
                        error: null
                      })
                    })
                  })
                })
              }
            }
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: userId },
                    error: null
                  })
                })
              })
            }
          })

          // Create update request
          const request = new NextRequest(`http://localhost:3000/api/predictions/${predictionId}`, {
            method: 'PUT',
            body: JSON.stringify({
              predicted_home_score: updatedHomeScore,
              predicted_away_score: updatedAwayScore
            })
          })

          // Call API
          const response = await PUT(request, { params: { id: predictionId } })
          const result = await response.json()

          // Verify rejection of processed prediction update
          expect(response.status).toBe(400)
          expect(result.success).toBe(false)
          expect(result.error).toContain('Cannot update processed predictions')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain data integrity across prediction operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate data for integrity checks
        fc.record({
          predictedHomeScore: fc.integer({ min: 0, max: 20 }),
          predictedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid(),
          predictionId: fc.uuid(),
          userEmail: fc.emailAddress()
        }),
        async ({ predictedHomeScore, predictedAwayScore, matchId, userId, predictionId, userEmail }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: userEmail }
          })

          let insertedPrediction: any = null

          // Mock user lookup and prediction operations
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: userId },
                      error: null
                    })
                  })
                })
              }
            }
            if (table === 'matches') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: matchId,
                        status: 'TIMED',
                        kickoff_time: new Date(Date.now() + 86400000).toISOString() // Future date
                      },
                      error: null
                    })
                  })
                })
              }
            }
            if (table === 'predictions') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: null,
                        error: { code: 'PGRST116' } // No existing prediction
                      })
                    })
                  })
                }),
                insert: vi.fn().mockImplementation((data) => {
                  insertedPrediction = {
                    id: predictionId,
                    ...data,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }
                  return {
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: insertedPrediction,
                        error: null
                      })
                    })
                  }
                })
              }
            }
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: userId },
                    error: null
                  })
                })
              })
            }
          })

          // Create request
          const request = new NextRequest('http://localhost:3000/api/predictions', {
            method: 'POST',
            body: JSON.stringify({
              match_id: matchId,
              predicted_home_score: predictedHomeScore,
              predicted_away_score: predictedAwayScore
            })
          })

          // Call API
          const response = await POST(request)
          const result = await response.json()

          // Verify data integrity
          expect(response.status).toBe(201)
          expect(result.success).toBe(true)
          expect(insertedPrediction).toBeDefined()
          expect(insertedPrediction.user_id).toBe(userId)
          expect(insertedPrediction.match_id).toBe(matchId)
          expect(insertedPrediction.predicted_home_score).toBe(predictedHomeScore)
          expect(insertedPrediction.predicted_away_score).toBe(predictedAwayScore)
          expect(insertedPrediction.points_earned).toBe(0)
          expect(insertedPrediction.processed).toBe(false)
          expect(typeof insertedPrediction.created_at).toBe('string')
          expect(typeof insertedPrediction.updated_at).toBe('string')
        }
      ),
      { numRuns: 100 }
    )
  })
})