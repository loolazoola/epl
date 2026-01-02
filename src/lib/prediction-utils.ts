/**
 * Utility functions for prediction timing and validation
 */

import { Match } from '@/types/database'

export interface PredictionTimingInfo {
  canPredict: boolean
  canEdit: boolean
  isLocked: boolean
  isExpired: boolean
  timeUntilKickoff: string | null
  timeUntilLockout: string | null
  status: 'available' | 'locked' | 'expired'
  statusMessage: string
}

/**
 * Get comprehensive prediction timing information for a match
 */
export function getPredictionTimingInfo(match: Match): PredictionTimingInfo {
  const now = new Date()
  const kickoffTime = new Date(match.kickoff_time)
  const lockoutTime = new Date(kickoffTime.getTime() - (2 * 60 * 60 * 1000)) // 2 hours before kickoff
  
  const diffToKickoff = kickoffTime.getTime() - now.getTime()
  const diffToLockout = lockoutTime.getTime() - now.getTime()
  
  // Match has already started or finished
  if (match.status !== 'TIMED' || diffToKickoff <= 0) {
    return {
      canPredict: false,
      canEdit: false,
      isLocked: true,
      isExpired: true,
      timeUntilKickoff: null,
      timeUntilLockout: null,
      status: 'expired',
      statusMessage: match.status === 'FINISHED' ? 'Match finished' : 'Match started'
    }
  }
  
  // Within 2 hours of kickoff - predictions locked
  if (diffToLockout <= 0) {
    return {
      canPredict: false,
      canEdit: false,
      isLocked: true,
      isExpired: false,
      timeUntilKickoff: formatTimeDifference(diffToKickoff),
      timeUntilLockout: null,
      status: 'locked',
      statusMessage: 'Prediction locked'
    }
  }
  
  // Predictions available
  return {
    canPredict: true,
    canEdit: true,
    isLocked: false,
    isExpired: false,
    timeUntilKickoff: formatTimeDifference(diffToKickoff),
    timeUntilLockout: formatTimeDifference(diffToLockout),
    status: 'available',
    statusMessage: 'Prediction available'
  }
}

/**
 * Format time difference in a human-readable format
 */
export function formatTimeDifference(diffMs: number): string | null {
  if (diffMs <= 0) return null
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) {
    const remainingHours = diffHours % 24
    if (remainingHours > 0) {
      return `${diffDays}d ${remainingHours}h`
    }
    return `${diffDays}d`
  } else if (diffHours > 0) {
    if (diffMinutes > 0) {
      return `${diffHours}h ${diffMinutes}m`
    }
    return `${diffHours}h`
  } else {
    return `${diffMinutes}m`
  }
}

/**
 * Get prediction button text based on timing and existing prediction
 */
export function getPredictionButtonText(
  timingInfo: PredictionTimingInfo,
  hasPrediction: boolean
): string {
  if (timingInfo.isExpired) {
    return 'Match Started'
  }
  
  if (timingInfo.isLocked) {
    return 'Prediction Locked'
  }
  
  return hasPrediction ? 'Edit Prediction' : 'Predict Score'
}

/**
 * Get prediction status indicator
 */
export function getPredictionStatusIndicator(
  timingInfo: PredictionTimingInfo,
  hasPrediction: boolean
): {
  text: string
  className: string
  icon: string
} {
  if (timingInfo.isExpired) {
    return {
      text: timingInfo.statusMessage,
      className: 'text-muted-foreground bg-muted border-border',
      icon: '⏰'
    }
  }
  
  if (timingInfo.isLocked) {
    return {
      text: hasPrediction ? 'Prediction Locked' : 'Predictions Closed',
      className: 'text-orange-600 bg-orange-50 border-orange-200',
      icon: '🔒'
    }
  }
  
  if (hasPrediction) {
    return {
      text: 'Prediction Submitted',
      className: 'text-green-600 bg-green-50 border-green-200',
      icon: '✅'
    }
  }
  
  return {
    text: 'Prediction Available',
    className: 'text-pl-secondary bg-pl-secondary/10 border-pl-secondary/20',
    icon: '⚽'
  }
}