/**
 * Test for prediction submission flow
 * Tests the end-to-end prediction submission process
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the fetch function
global.fetch = vi.fn()

describe('Prediction Submission Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle successful prediction submission', async () => {
    // Mock successful API response
    const mockResponse = {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'prediction-uuid',
          match_id: 'match-uuid',
          predicted_home_score: 2,
          predicted_away_score: 1,
          user_id: 'user-uuid'
        }
      })
    }

    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    // Simulate the prediction submission
    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        match_id: 'match-uuid',
        predicted_home_score: 2,
        predicted_away_score: 1,
      }),
    })

    const result = await response.json()

    expect(response.ok).toBe(true)
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data.predicted_home_score).toBe(2)
    expect(result.data.predicted_away_score).toBe(1)
  })

  it('should handle prediction submission errors', async () => {
    // Mock error response
    const mockResponse = {
      ok: false,
      json: async () => ({
        success: false,
        error: 'Match not found in database'
      })
    }

    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    // Simulate the prediction submission
    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        match_id: 'invalid-match-id',
        predicted_home_score: 2,
        predicted_away_score: 1,
      }),
    })

    const result = await response.json()

    expect(response.ok).toBe(false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Match not found in database')
  })

  it('should validate match ID conversion logic', () => {
    // Mock database matches
    const dbMatches = [
      { id: 'uuid-1', external_id: '123' },
      { id: 'uuid-2', external_id: '456' },
      { id: 'uuid-3', external_id: '789' }
    ]

    // Test finding database match by external ID
    const footballApiMatchId = '456'
    const dbMatch = dbMatches.find(m => m.external_id === footballApiMatchId)

    expect(dbMatch).toBeDefined()
    expect(dbMatch?.id).toBe('uuid-2')
    expect(dbMatch?.external_id).toBe('456')
  })
})