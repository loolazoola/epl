/**
 * Property-Based Test for Prediction Timing Validation
 * Feature: premier-league-prediction-game, Property 4: Prediction Timing Validation
 * Validates: Requirements 3.2, 3.4, 3.6
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
          single: vi.fn()
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

describe('Property 4: Prediction Timing Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property 4: Prediction Timing Validation
   * For any prediction submission attempt, the system should validate match timing 
   * (not started, not finished) and reject predictions with appropriate error messages 
   * when timing constraints are violated.
   * Validates: Requirements 3.2, 3.4, 3.6
   */
  it('should reject predictions for matches that have started or finished', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate match states that should reject predictions
        fc.record({
          matchStatus: fc.constantFrom('IN_PLAY', 'PAUSED', 'FINISHED'),
          kickoffTime: fc.integer({ min: 946684800000, max: Date.now() - 60000 }).map(timestamp => new Date(timestamp)), // Past dates as timestamps
          predictedHomeScore: fc.integer({ min: 0, max: 20 }),
          predictedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid()
        }),
        async ({ matchStatus, kickoffTime, predictedHomeScore, predictedAwayScore, matchId, userId }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: 'test@example.com' }
          })

          // Mock user lookup
          mockSupabase.from.mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: userId },
                  error: null
                })
              })
            })
          })

          // Mock match lookup with invalid timing
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'matches') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: matchId,
                        status: matchStatus,
                        kickoff_time: kickoffTime.toISOString()
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

          // Verify rejection
          expect(response.status).toBe(400)
          expect(result.success).toBe(false)
          expect(result.error).toContain('Cannot submit predictions for matches that have started or finished')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should accept predictions for matches that have not started', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid future match states
        fc.record({
          kickoffTime: fc.integer({ min: Date.now() + 60000, max: Date.now() + 86400000 }).map(timestamp => new Date(timestamp)), // Future dates as timestamps
          predictedHomeScore: fc.integer({ min: 0, max: 20 }),
          predictedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid(),
          predictionId: fc.uuid()
        }),
        async ({ kickoffTime, predictedHomeScore, predictedAwayScore, matchId, userId, predictionId }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: 'test@example.com' }
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
                        kickoff_time: kickoffTime.toISOString()
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
                        processed: false
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

          // Verify acceptance
          expect(response.status).toBe(201)
          expect(result.success).toBe(true)
          expect(result.data).toBeDefined()
          expect(result.data.predicted_home_score).toBe(predictedHomeScore)
          expect(result.data.predicted_away_score).toBe(predictedAwayScore)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject prediction updates for matches that have started', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate match states that should reject updates
        fc.record({
          matchStatus: fc.constantFrom('IN_PLAY', 'PAUSED', 'FINISHED'),
          kickoffTime: fc.integer({ min: 946684800000, max: Date.now() - 60000 }).map(timestamp => new Date(timestamp)), // Past dates as timestamps
          predictedHomeScore: fc.integer({ min: 0, max: 20 }),
          predictedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid(),
          predictionId: fc.uuid()
        }),
        async ({ matchStatus, kickoffTime, predictedHomeScore, predictedAwayScore, matchId, userId, predictionId }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: 'test@example.com' }
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
                          processed: false,
                          match: {
                            id: matchId,
                            status: matchStatus,
                            kickoff_time: kickoffTime.toISOString()
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

          // Create request
          const request = new NextRequest(`http://localhost:3000/api/predictions/${predictionId}`, {
            method: 'PUT',
            body: JSON.stringify({
              predicted_home_score: predictedHomeScore,
              predicted_away_score: predictedAwayScore
            })
          })

          // Call API
          const response = await PUT(request, { params: { id: predictionId } })
          const result = await response.json()

          // Verify rejection
          expect(response.status).toBe(400)
          expect(result.success).toBe(false)
          expect(result.error).toContain('Cannot update predictions for matches that have started or finished')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should validate score ranges for all predictions', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid score ranges
        fc.record({
          predictedHomeScore: fc.oneof(
            fc.integer({ max: -1 }), // Negative scores
            fc.integer({ min: 21 })   // Scores above 20
          ),
          predictedAwayScore: fc.integer({ min: 0, max: 20 }),
          matchId: fc.uuid(),
          userId: fc.uuid()
        }),
        async ({ predictedHomeScore, predictedAwayScore, matchId, userId }) => {
          // Setup mocks for authenticated user
          mockGetServerSession.mockResolvedValue({
            user: { email: 'test@example.com' }
          })

          // Mock user lookup
          mockSupabase.from.mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: userId },
                  error: null
                })
              })
            })
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

          // Verify rejection for invalid scores
          expect(response.status).toBe(400)
          expect(result.success).toBe(false)
          expect(result.error).toContain('Predicted scores must be between 0 and 20')
        }
      ),
      { numRuns: 100 }
    )
  })
})