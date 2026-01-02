import { Match, Prediction } from '@/types/database'

/**
 * Scoring algorithm for Premier League predictions
 * Awards points based on prediction accuracy:
 * - 5 points: Exact score match
 * - 2 points: Correct outcome (win/draw/loss) but wrong score
 * - 0 points: Incorrect outcome
 */

export interface ScoringResult {
  points: number
  reason: 'exact_score' | 'correct_outcome' | 'incorrect'
}

/**
 * Calculate points for a single prediction based on match result
 */
export function calculatePoints(
  prediction: Pick<Prediction, 'predicted_home_score' | 'predicted_away_score'>,
  match: Pick<Match, 'home_score' | 'away_score'>
): ScoringResult {
  // Validate that match has finished with scores
  if (match.home_score === null || match.home_score === undefined ||
      match.away_score === null || match.away_score === undefined) {
    throw new Error('Match must have final scores to calculate points')
  }

  const actualHomeScore = match.home_score
  const actualAwayScore = match.away_score
  const predictedHomeScore = prediction.predicted_home_score
  const predictedAwayScore = prediction.predicted_away_score

  // Check for exact score match
  if (actualHomeScore === predictedHomeScore && actualAwayScore === predictedAwayScore) {
    return {
      points: 5,
      reason: 'exact_score'
    }
  }

  // Determine actual match outcome
  const actualOutcome = getMatchOutcome(actualHomeScore, actualAwayScore)
  
  // Determine predicted outcome
  const predictedOutcome = getMatchOutcome(predictedHomeScore, predictedAwayScore)

  // Check if outcomes match
  if (actualOutcome === predictedOutcome) {
    return {
      points: 2,
      reason: 'correct_outcome'
    }
  }

  // Incorrect prediction
  return {
    points: 0,
    reason: 'incorrect'
  }
}

/**
 * Determine match outcome from scores
 */
export function getMatchOutcome(homeScore: number, awayScore: number): 'home_win' | 'away_win' | 'draw' {
  if (homeScore > awayScore) {
    return 'home_win'
  } else if (awayScore > homeScore) {
    return 'away_win'
  } else {
    return 'draw'
  }
}

/**
 * Calculate points for multiple predictions
 */
export function calculateBatchPoints(
  predictions: Pick<Prediction, 'id' | 'predicted_home_score' | 'predicted_away_score'>[],
  match: Pick<Match, 'home_score' | 'away_score'>
): Array<{ predictionId: string; result: ScoringResult }> {
  return predictions.map(prediction => ({
    predictionId: prediction.id,
    result: calculatePoints(prediction, match)
  }))
}

/**
 * Validate prediction scores are within reasonable range
 */
export function validatePredictionScores(homeScore: number, awayScore: number): boolean {
  // Scores must be non-negative integers and within reasonable football range (0-20)
  return Number.isInteger(homeScore) && 
         Number.isInteger(awayScore) && 
         homeScore >= 0 && 
         homeScore <= 20 && 
         awayScore >= 0 && 
         awayScore <= 20
}