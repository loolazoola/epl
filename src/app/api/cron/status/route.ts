import { NextRequest, NextResponse } from 'next/server'
import { getProcessingStats, hasUnprocessedMatches } from '@/lib/score-processor'
import { getSyncStatus } from '@/lib/match-sync'
import { getCacheStats } from '@/lib/match-cache'

export async function GET(request: NextRequest) {
  try {
    // Get processing statistics
    let processingStats
    try {
      processingStats = await getProcessingStats()
    } catch (error) {
      console.warn('Failed to get processing stats, using defaults:', error)
      processingStats = {
        total_matches: 0,
        finished_matches: 0,
        processed_predictions: 0,
        unprocessed_predictions: 0,
        total_points_awarded: 0
      }
    }
    
    // Check if there are unprocessed matches
    const hasUnprocessed = await hasUnprocessedMatches()
    
    // Get sync status
    const syncStatus = await getSyncStatus()
    
    // Get cache statistics
    const cacheStats = getCacheStats()

    return NextResponse.json({
      success: true,
      data: {
        processing: {
          totalMatches: Number(processingStats.total_matches) || 0,
          finishedMatches: Number(processingStats.finished_matches) || 0,
          processedPredictions: Number(processingStats.processed_predictions) || 0,
          unprocessedPredictions: Number(processingStats.unprocessed_predictions) || 0,
          totalPointsAwarded: Number(processingStats.total_points_awarded) || 0,
          hasUnprocessedMatches: hasUnprocessed
        },
        sync: syncStatus,
        cache: cacheStats,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Failed to get cron job status:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}