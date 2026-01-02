import { NextRequest, NextResponse } from 'next/server'
import { processAllFinishedMatches } from '@/lib/score-processor'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    // In production, you might want to verify a secret token
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting score processing job...')
    
    const result = await processAllFinishedMatches()
    
    console.log('Score processing completed:', {
      processedMatches: result.processedMatches,
      totalPredictionsProcessed: result.totalPredictionsProcessed,
      totalPointsAwarded: result.totalPointsAwarded,
      errorCount: result.errors.length
    })

    // Log errors if any
    if (result.errors.length > 0) {
      console.error('Score processing errors:', result.errors)
    }

    return NextResponse.json({
      success: true,
      data: {
        processedMatches: result.processedMatches,
        totalPredictionsProcessed: result.totalPredictionsProcessed,
        totalPointsAwarded: result.totalPointsAwarded,
        errors: result.errors
      }
    })

  } catch (error) {
    console.error('Score processing job failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

// Allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request)
}