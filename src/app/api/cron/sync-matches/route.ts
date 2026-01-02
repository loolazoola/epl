import { NextRequest, NextResponse } from 'next/server'
import { syncMatchData } from '@/lib/match-sync'

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

    console.log('Starting match data sync job...')
    
    const result = await syncMatchData()
    
    console.log('Match data sync completed:', {
      newMatches: result.newMatches,
      updatedMatches: result.updatedMatches,
      totalMatches: result.totalMatches,
      errorCount: result.errors.length
    })

    // Log errors if any
    if (result.errors.length > 0) {
      console.error('Match sync errors:', result.errors)
    }

    return NextResponse.json({
      success: true,
      data: {
        newMatches: result.newMatches,
        updatedMatches: result.updatedMatches,
        totalMatches: result.totalMatches,
        errors: result.errors
      }
    })

  } catch (error) {
    console.error('Match sync job failed:', error)
    
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