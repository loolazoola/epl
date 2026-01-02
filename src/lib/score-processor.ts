import { Match, Prediction, User } from '@/types/database'
import { matchOperations, predictionOperations, userOperations } from './database'
import { calculatePoints, ScoringResult } from './scoring'
import { createServerClient } from './supabase'
import { atomicScoreProcessing } from './transactions'
import { dbErrorHandler, createAppError, ErrorType, logError } from './error-handling'

export interface ProcessingResult {
  matchId: string
  processedPredictions: number
  totalPointsAwarded: number
  errors: string[]
}

export interface BatchProcessingResult {
  processedMatches: number
  totalPredictionsProcessed: number
  totalPointsAwarded: number
  errors: string[]
}

/**
 * Process scores for a single finished match
 * Updates all unprocessed predictions and user totals with atomic transactions
 */
export async function processMatchScores(matchId: string): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    matchId,
    processedPredictions: 0,
    totalPointsAwarded: 0,
    errors: []
  }

  try {
    // Get the finished match with error handling
    const match = await dbErrorHandler.execute(async () => {
      return await matchOperations.getById(matchId)
    })

    if (!match) {
      result.errors.push(`Match not found: ${matchId}`)
      return result
    }

    // Verify match is finished and has scores
    if (match.status !== 'FINISHED') {
      result.errors.push(`Match is not finished: ${matchId}`)
      return result
    }

    if (match.home_score === null || match.home_score === undefined ||
        match.away_score === null || match.away_score === undefined) {
      result.errors.push(`Match does not have final scores: ${matchId}`)
      return result
    }

    console.log(`Processing scores for match: ${match.home_team} vs ${match.away_team} (${match.home_score}-${match.away_score})`)

    // Use atomic score processing function
    const atomicResult = await atomicScoreProcessing(
      matchId,
      match.home_score,
      match.away_score
    )

    if (atomicResult.success && atomicResult.data) {
      result.processedPredictions = atomicResult.data.processedPredictions
      result.totalPointsAwarded = atomicResult.data.totalPointsAwarded
      
      console.log(`Match ${matchId} processing completed atomically: ${result.processedPredictions} predictions, ${result.totalPointsAwarded} points awarded`)
    } else {
      result.errors.push(atomicResult.error || 'Atomic score processing failed')
      logError(new Error(atomicResult.error || 'Atomic score processing failed'), {
        matchId,
        homeScore: match.home_score,
        awayScore: match.away_score
      })
    }

  } catch (error) {
    const errorMsg = `Failed to process match ${matchId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    result.errors.push(errorMsg)
    logError(error instanceof Error ? error : new Error(errorMsg), {
      matchId,
      operation: 'processMatchScores'
    })
  }

  return result
}

/**
 * Process scores for all finished matches that have unprocessed predictions
 * This is the main function called by cron jobs with enhanced error recovery
 */
export async function processAllFinishedMatches(): Promise<BatchProcessingResult> {
  const batchResult: BatchProcessingResult = {
    processedMatches: 0,
    totalPredictionsProcessed: 0,
    totalPointsAwarded: 0,
    errors: []
  }

  const supabase = createServerClient()

  try {
    console.log('Starting batch score processing for all finished matches...')

    // Get all finished matches with unprocessed predictions in a single query
    const { data: matchesWithUnprocessed, error: queryError } = await supabase
      .from('matches')
      .select(`
        id,
        external_id,
        home_team,
        away_team,
        home_score,
        away_score,
        status,
        kickoff_time,
        predictions!inner(id, processed)
      `)
      .eq('status', 'FINISHED')
      .eq('predictions.processed', false)

    if (queryError) {
      batchResult.errors.push(`Failed to query matches with unprocessed predictions: ${queryError.message}`)
      return batchResult
    }

    // Group by match to get unique matches
    const uniqueMatches = new Map()
    if (matchesWithUnprocessed) {
      matchesWithUnprocessed.forEach((match: any) => {
        if (!uniqueMatches.has(match.id)) {
          uniqueMatches.set(match.id, {
            id: match.id,
            external_id: match.external_id,
            home_team: match.home_team,
            away_team: match.away_team,
            home_score: match.home_score,
            away_score: match.away_score,
            status: match.status,
            kickoff_time: match.kickoff_time
          })
        }
      })
    }

    const matchesToProcess = Array.from(uniqueMatches.values())
    console.log(`Found ${matchesToProcess.length} finished matches with unprocessed predictions`)

    if (matchesToProcess.length === 0) {
      console.log('No matches require score processing')
      return batchResult
    }

    // Process matches with retry logic
    const MAX_RETRIES = 3
    const RETRY_DELAY = 1000 // 1 second

    for (const match of matchesToProcess) {
      let retryCount = 0
      let processed = false

      while (!processed && retryCount < MAX_RETRIES) {
        try {
          console.log(`Processing match: ${match.home_team} vs ${match.away_team} (attempt ${retryCount + 1})`)
          
          const matchResult = await processMatchScores(match.id)
          
          batchResult.processedMatches++
          batchResult.totalPredictionsProcessed += matchResult.processedPredictions
          batchResult.totalPointsAwarded += matchResult.totalPointsAwarded
          batchResult.errors.push(...matchResult.errors)
          
          processed = true
          
          if (matchResult.processedPredictions > 0) {
            console.log(`Successfully processed ${matchResult.processedPredictions} predictions for match ${match.id}`)
          }
          
        } catch (error) {
          retryCount++
          const errorMsg = `Attempt ${retryCount} failed for match ${match.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          
          if (retryCount >= MAX_RETRIES) {
            batchResult.errors.push(`Max retries exceeded for match ${match.id}: ${errorMsg}`)
            console.error(`Max retries exceeded for match ${match.id}`, error)
          } else {
            console.warn(`Retrying match ${match.id} in ${RETRY_DELAY}ms: ${errorMsg}`)
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          }
        }
      }
    }

    console.log(`Batch processing completed: ${batchResult.processedMatches} matches, ${batchResult.totalPredictionsProcessed} predictions, ${batchResult.totalPointsAwarded} points awarded`)

  } catch (error) {
    const errorMsg = `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    batchResult.errors.push(errorMsg)
    console.error('Batch score processing failed:', error)
  }

  return batchResult
}

/**
 * Reprocess a specific match (admin function)
 * This will reset all predictions for the match and recalculate points
 */
export async function reprocessMatch(matchId: string): Promise<ProcessingResult> {
  const supabase = createServerClient()
  
  try {
    // Reset all predictions for this match to unprocessed
    const resetData = { processed: false, points_earned: 0 }
    await (supabase as any)
      .from('predictions')
      .update(resetData)
      .eq('match_id', matchId)
    
    // Get all predictions to subtract their current points from user totals
    const predictions = await predictionOperations.getByMatchId(matchId)
    
    // Subtract previously awarded points from user totals
    const userPointSubtractions = new Map<string, number>()
    for (const prediction of predictions) {
      if (prediction.points_earned > 0) {
        const currentSubtraction = userPointSubtractions.get(prediction.user_id) || 0
        userPointSubtractions.set(prediction.user_id, currentSubtraction + prediction.points_earned)
      }
    }
    
    // Apply point subtractions
    for (const [userId, pointsToSubtract] of userPointSubtractions) {
      const user = await userOperations.getById(userId)
      if (user) {
        const newTotal = Math.max(0, user.total_points - pointsToSubtract)
        await userOperations.updatePoints(userId, newTotal)
      }
    }
    
    // Now process the match normally
    return await processMatchScores(matchId)
    
  } catch (error) {
    throw new Error(`Failed to reprocess match ${matchId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get processing statistics and status
 */
export async function getProcessingStats() {
  const supabase = createServerClient()
  
  try {
    const { data, error } = await (supabase as any).rpc('get_processing_stats')
    
    if (error) {
      throw new Error(`Failed to get processing stats: ${error.message}`)
    }
    
    return data?.[0] || {
      total_matches: 0,
      finished_matches: 0,
      processed_predictions: 0,
      unprocessed_predictions: 0,
      total_points_awarded: 0
    }
  } catch (error) {
    console.error('Failed to get processing stats:', error)
    throw error
  }
}

/**
 * Check if there are any matches that need score processing
 */
export async function hasUnprocessedMatches(): Promise<boolean> {
  const supabase = createServerClient()
  
  try {
    // First get unprocessed prediction match IDs
    const { data: unprocessedPredictions, error: predError } = await supabase
      .from('predictions')
      .select('match_id')
      .eq('processed', false)
    
    if (predError) {
      throw new Error(`Failed to get unprocessed predictions: ${predError.message}`)
    }
    
    if (!unprocessedPredictions || unprocessedPredictions.length === 0) {
      return false
    }
    
    // Get unique match IDs
    const matchIds = [...new Set(unprocessedPredictions.map((p: any) => p.match_id))]
    
    // Check if any of these matches are finished
    const { count: finishedCount, error: matchError } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'FINISHED')
      .in('id', matchIds)
    
    if (matchError) {
      throw new Error(`Failed to check for finished matches: ${matchError.message}`)
    }
    
    return (finishedCount || 0) > 0
  } catch (error) {
    console.error('Failed to check for unprocessed matches:', error)
    return false
  }
}