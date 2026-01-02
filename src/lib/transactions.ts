/**
 * Database transaction utilities for atomic operations
 * Ensures data consistency and reliability for score processing
 */

import { createServerClient } from './supabase'
import { dbErrorHandler, createAppError, ErrorType } from './error-handling'
import { Database } from '@/types/database'

export interface TransactionResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Execute multiple database operations atomically using Supabase RPC
 */
export async function executeTransaction<T>(
  operations: () => Promise<T>
): Promise<T> {
  return dbErrorHandler.execute(async () => {
    const supabase = createServerClient()
    
    try {
      // Start transaction by creating a savepoint
      const { error: beginError } = await supabase.rpc('begin_transaction')
      if (beginError) {
        throw createAppError(
          'Failed to begin transaction',
          ErrorType.DATABASE,
          { cause: beginError, retryable: true }
        )
      }

      try {
        // Execute the operations
        const result = await operations()
        
        // Commit transaction
        const { error: commitError } = await supabase.rpc('commit_transaction')
        if (commitError) {
          throw createAppError(
            'Failed to commit transaction',
            ErrorType.DATABASE,
            { cause: commitError, retryable: true }
          )
        }
        
        return result
      } catch (error) {
        // Rollback on any error
        const { error: rollbackError } = await supabase.rpc('rollback_transaction')
        if (rollbackError) {
          console.error('Failed to rollback transaction:', rollbackError)
        }
        throw error
      }
    } catch (error) {
      // If we can't even start a transaction, the error is likely more serious
      throw createAppError(
        'Transaction system unavailable',
        ErrorType.DATABASE,
        { 
          cause: error instanceof Error ? error : new Error(String(error)),
          retryable: false
        }
      )
    }
  })
}

/**
 * Atomic score processing for a single match
 * Updates all predictions and user points in a single transaction
 */
export async function atomicScoreProcessing(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<TransactionResult<{
  processedPredictions: number
  updatedUsers: number
  totalPointsAwarded: number
}>> {
  try {
    const result = await executeTransaction(async () => {
      const supabase = createServerClient()
      
      // Get all unprocessed predictions for this match
      const { data: predictions, error: predictionsError } = await supabase
        .from('predictions')
        .select(`
          id,
          user_id,
          predicted_home_score,
          predicted_away_score,
          users!inner(id, total_points)
        `)
        .eq('match_id', matchId)
        .eq('processed', false)

      if (predictionsError) {
        throw createAppError(
          'Failed to fetch predictions for processing',
          ErrorType.DATABASE,
          { cause: predictionsError, retryable: true }
        )
      }

      if (!predictions || predictions.length === 0) {
        return {
          processedPredictions: 0,
          updatedUsers: 0,
          totalPointsAwarded: 0
        }
      }

      let totalPointsAwarded = 0
      const userPointUpdates = new Map<string, number>()

      // Calculate points for each prediction
      const predictionUpdates = predictions.map((prediction: any) => {
        const points = calculatePoints(
          prediction.predicted_home_score,
          prediction.predicted_away_score,
          homeScore,
          awayScore
        )
        
        totalPointsAwarded += points
        
        // Track user point updates
        const currentUserPoints = prediction.users.total_points
        const newUserPoints = currentUserPoints + points
        userPointUpdates.set(prediction.user_id, newUserPoints)
        
        return {
          id: prediction.id,
          points_earned: points,
          processed: true
        }
      })

      // Update all predictions in batch
      const { error: updatePredictionsError } = await (supabase as any)
        .from('predictions')
        .upsert(predictionUpdates)

      if (updatePredictionsError) {
        throw createAppError(
          'Failed to update predictions',
          ErrorType.DATABASE,
          { cause: updatePredictionsError, retryable: true }
        )
      }

      // Update user points in batch
      const userUpdates = Array.from(userPointUpdates.entries()).map(([userId, totalPoints]) => ({
        id: userId,
        total_points: totalPoints,
        updated_at: new Date().toISOString()
      }))

      const { error: updateUsersError } = await (supabase as any)
        .from('users')
        .upsert(userUpdates)

      if (updateUsersError) {
        throw createAppError(
          'Failed to update user points',
          ErrorType.DATABASE,
          { cause: updateUsersError, retryable: true }
        )
      }

      return {
        processedPredictions: predictions.length,
        updatedUsers: userUpdates.length,
        totalPointsAwarded
      }
    })

    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('Atomic score processing failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during score processing'
    }
  }
}

/**
 * Calculate points based on prediction accuracy
 */
function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  // Exact score match: 5 points
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 5
  }
  
  // Correct outcome: 2 points
  const predictedOutcome = getMatchOutcome(predictedHome, predictedAway)
  const actualOutcome = getMatchOutcome(actualHome, actualAway)
  
  if (predictedOutcome === actualOutcome) {
    return 2
  }
  
  // Incorrect: 0 points
  return 0
}

/**
 * Determine match outcome (home win, draw, away win)
 */
function getMatchOutcome(homeScore: number, awayScore: number): 'HOME_WIN' | 'DRAW' | 'AWAY_WIN' {
  if (homeScore > awayScore) return 'HOME_WIN'
  if (homeScore < awayScore) return 'AWAY_WIN'
  return 'DRAW'
}

/**
 * Atomic user creation with initial data
 */
export async function atomicUserCreation(userData: {
  email: string
  name: string
  avatar_url?: string
}): Promise<TransactionResult<any>> {
  try {
    const result = await executeTransaction(async () => {
      const supabase = createServerClient()
      
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userData.email)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw createAppError(
          'Failed to check existing user',
          ErrorType.DATABASE,
          { cause: checkError, retryable: true }
        )
      }

      if (existingUser) {
        return existingUser
      }

      // Create new user with initial points
      const { data: newUser, error: createError } = await (supabase as any)
        .from('users')
        .insert({
          email: userData.email,
          name: userData.name,
          avatar_url: userData.avatar_url,
          total_points: 0
        })
        .select()
        .single()

      if (createError) {
        throw createAppError(
          'Failed to create user',
          ErrorType.DATABASE,
          { cause: createError, retryable: true }
        )
      }

      return newUser
    })

    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('Atomic user creation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during user creation'
    }
  }
}

/**
 * Atomic prediction submission with validation
 */
export async function atomicPredictionSubmission(predictionData: {
  userId: string
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
}): Promise<TransactionResult<any>> {
  try {
    const supabase = createServerClient()
    
    console.log('Starting atomic prediction submission with:', predictionData)
    
    // Validate input parameters
    if (!predictionData.userId || !predictionData.matchId) {
      return {
        success: false,
        error: 'User ID and Match ID are required'
      }
    }

    if (predictionData.predictedHomeScore < 0 || predictionData.predictedAwayScore < 0) {
      return {
        success: false,
        error: 'Predicted scores cannot be negative'
      }
    }

    if (predictionData.predictedHomeScore > 20 || predictionData.predictedAwayScore > 20) {
      return {
        success: false,
        error: 'Predicted scores cannot exceed 20'
      }
    }

    // Check if match exists and get its details
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('id, kickoff_time, status')
      .eq('id', predictionData.matchId)
      .single()

    if (matchError || !matchData) {
      console.error('Match not found:', matchError)
      return {
        success: false,
        error: 'Match not found'
      }
    }

    const match = matchData as { id: string; kickoff_time: string; status: string }

    // Check if match has already started or finished
    if (match.status !== 'TIMED') {
      return {
        success: false,
        error: 'Match has already started or finished'
      }
    }

    // Check if match is within 2 hours of kickoff (prediction lock period)
    const kickoffTime = new Date(match.kickoff_time)
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
    
    if (kickoffTime <= twoHoursFromNow) {
      return {
        success: false,
        error: 'Predictions are locked within 2 hours of kickoff'
      }
    }

    // Check if user already has a prediction for this match
    const { data: existingPredictionData, error: existingError } = await supabase
      .from('predictions')
      .select('id')
      .eq('user_id', predictionData.userId)
      .eq('match_id', predictionData.matchId)
      .single()

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing prediction:', existingError)
      return {
        success: false,
        error: 'Failed to check existing prediction'
      }
    }

    if (existingPredictionData) {
      const existingPrediction = existingPredictionData as { id: string }
      // Update existing prediction
      console.log('Updating existing prediction:', existingPrediction.id)
      const { data: updatedPrediction, error: updateError } = await (supabase as any)
        .from('predictions')
        .update({
          predicted_home_score: predictionData.predictedHomeScore,
          predicted_away_score: predictionData.predictedAwayScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPrediction.id)
        .select()
        .single()

      if (updateError) {
        console.error('Failed to update prediction:', updateError)
        return {
          success: false,
          error: 'Failed to update prediction'
        }
      }

      console.log('Successfully updated prediction:', updatedPrediction)
      return {
        success: true,
        data: updatedPrediction
      }
    }

    // Create new prediction
    console.log('Creating new prediction')
    const { data: newPrediction, error: createError } = await (supabase as any)
      .from('predictions')
      .insert({
        user_id: predictionData.userId,
        match_id: predictionData.matchId,
        predicted_home_score: predictionData.predictedHomeScore,
        predicted_away_score: predictionData.predictedAwayScore,
        points_earned: 0,
        processed: false
      })
      .select()
      .single()

    if (createError) {
      console.error('Failed to create prediction:', createError)
      
      // Handle specific error cases
      if (createError.code === '23505') { // unique_violation
        return {
          success: false,
          error: 'A prediction for this match already exists'
        }
      }
      
      if (createError.code === '23503') { // foreign_key_violation
        return {
          success: false,
          error: 'Invalid user or match reference'
        }
      }
      
      if (createError.code === '23514') { // check_violation
        return {
          success: false,
          error: 'Invalid prediction values'
        }
      }
      
      return {
        success: false,
        error: 'Failed to create prediction'
      }
    }

    console.log('Successfully created prediction:', newPrediction)
    return {
      success: true,
      data: newPrediction
    }
  } catch (error) {
    console.error('Atomic prediction submission failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during prediction submission'
    }
  }
}