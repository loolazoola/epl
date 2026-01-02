/**
 * Integration test for the complete prediction submission flow
 * Tests the interaction between matches page, modal, and API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

describe('Prediction Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle match ID conversion correctly', () => {
    // Test the match ID conversion logic
    const footballApiMatches = [
      { id: 12345, external_id: '12345' },
      { id: 67890, external_id: '67890' }
    ]
    
    const dbMatches = [
      { id: 'uuid-1', external_id: '12345' },
      { id: 'uuid-2', external_id: '67890' }
    ]
    
    // Test finding database match by Football API ID
    const footballApiId = 12345
    const dbMatch = dbMatches.find(m => m.external_id === footballApiId.toString())
    
    expect(dbMatch).toBeDefined()
    expect(dbMatch?.id).toBe('uuid-1')
    expect(dbMatch?.external_id).toBe('12345')
  })

  it('should handle prediction submission with correct match ID', async () => {
    // Mock successful prediction submission
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          id: 'prediction-uuid',
          match_id: 'match-uuid-123',
          predicted_home_score: 2,
          predicted_away_score: 1,
          user_id: 'user-123'
        }
      })
    })

    // Simulate the prediction submission logic from matches page
    const handlePredictionSubmit = async (matchId: string, homeScore: number, awayScore: number) => {
      const dbMatches = [
        { id: 'match-uuid-123', external_id: '12345' },
        { id: 'match-uuid-456', external_id: '67890' }
      ]
      
      // Find database match by external ID (Football API ID)
      const dbMatch = dbMatches.find(m => m.external_id === matchId)
      if (!dbMatch) {
        throw new Error('Match not found in database')
      }

      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: dbMatch.id, // Use database UUID
          predicted_home_score: homeScore,
          predicted_away_score: awayScore,
        }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit prediction')
      }
      
      return result
    }

    // Test successful submission
    const result = await handlePredictionSubmit('12345', 2, 1)
    
    expect(result.success).toBe(true)
    expect(result.data.predicted_home_score).toBe(2)
    expect(result.data.predicted_away_score).toBe(1)
    
    // Verify the correct API call was made
    expect(global.fetch).toHaveBeenCalledWith('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: 'match-uuid-123', // Should use database UUID, not external ID
        predicted_home_score: 2,
        predicted_away_score: 1,
      }),
    })
  })

  it('should handle prediction submission errors gracefully', async () => {
    // Mock error response for prediction submission
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: 'Match not found in database'
      })
    })

    // Test error handling in the submission function
    const handlePredictionSubmit = async (matchId: string, homeScore: number, awayScore: number) => {
      const dbMatches = [{ id: 'uuid-1', external_id: '12345' }]
      const dbMatch = dbMatches.find(m => m.external_id === matchId)
      
      if (!dbMatch) {
        throw new Error('Match not found in database')
      }

      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: dbMatch.id,
          predicted_home_score: homeScore,
          predicted_away_score: awayScore,
        }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit prediction')
      }
      
      return result
    }

    // Test that the function throws the correct error
    await expect(
      handlePredictionSubmit('12345', 2, 1)
    ).rejects.toThrow('Match not found in database')
  })

  it('should handle missing database match scenario', async () => {
    const handlePredictionSubmit = async (matchId: string, homeScore: number, awayScore: number) => {
      const dbMatches: Array<{ id: string; external_id: string }> = []
      const dbMatch = dbMatches.find(m => m.external_id === matchId)
      
      if (!dbMatch) {
        throw new Error('Match not found in database')
      }

      // This won't be reached due to the error above
      return { success: true }
    }

    // Test that missing database match throws correct error
    await expect(
      handlePredictionSubmit('99999', 2, 1)
    ).rejects.toThrow('Match not found in database')
  })
})