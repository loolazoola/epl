/**
 * Test to verify the database function create_prediction_atomic works correctly
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createServerClient } from '@/lib/supabase'

describe('Database Function Tests', () => {
  let supabase: any

  beforeAll(() => {
    supabase = createServerClient()
  })

  it('should be able to call create_prediction_atomic function', async () => {
    // Test with dummy data to see if the function exists and can be called
    const { data, error } = await supabase.rpc('create_prediction_atomic', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_match_id: '00000000-0000-0000-0000-000000000000',
      p_predicted_home_score: 1,
      p_predicted_away_score: 0
    })

    console.log('Function call result:', { data, error })

    // We expect this to fail with a specific error (match not found)
    // but the function should exist and be callable
    expect(error).toBeNull() // No database/function errors
    expect(data).toBeDefined()
    expect(Array.isArray(data)).toBe(true)
    
    if (data && data.length > 0) {
      expect(data[0]).toHaveProperty('success')
      expect(data[0]).toHaveProperty('error_message')
      // Should fail because match doesn't exist
      expect(data[0].success).toBe(false)
      expect(data[0].error_message).toBe('Match not found')
    }
  })

  it('should test the function result structure', async () => {
    // Test the structure of the function result
    const { data, error } = await supabase.rpc('create_prediction_atomic', {
      p_user_id: '11111111-1111-1111-1111-111111111111',
      p_match_id: '22222222-2222-2222-2222-222222222222',
      p_predicted_home_score: 2,
      p_predicted_away_score: 1
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)
    
    const result = data[0]
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('prediction_id')
    expect(result).toHaveProperty('error_message')
    expect(typeof result.success).toBe('boolean')
  })
})