import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { ApiResponse, Prediction } from '@/types/database'
import { atomicPredictionSubmission } from '@/lib/transactions'

// GET /api/predictions - Get user's predictions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Authentication required',
        data: null
      }, { status: 401 })
    }

    const supabase = createServerClient()

    // Use user ID directly from session instead of looking up by email
    const userId = session.user.id

    // Get user's predictions with match details
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select(`
        *,
        match:matches(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching predictions:', error)
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to fetch predictions',
        data: null
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<Prediction[]>>({
      success: true,
      data: predictions || []
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/predictions:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 })
  }
}

// POST /api/predictions - Create new prediction
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/predictions called')
    
    const session = await getServerSession(authOptions)
    console.log('Session:', session)
    
    if (!session?.user?.email || !session?.user?.id) {
      console.log('No session or user')
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Authentication required',
        data: null
      }, { status: 401 })
    }

    const body = await request.json()
    console.log('Request body:', body)

    // Simple validation
    if (!body.match_id || body.predicted_home_score === undefined || body.predicted_away_score === undefined) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Missing required fields',
        data: null
      }, { status: 400 })
    }

    const { match_id, predicted_home_score, predicted_away_score } = body

    // Use user ID directly from session instead of looking up by email
    const userId = session.user.id

    // Use atomic prediction submission
    console.log('Submitting prediction with data:', {
      userId: userId,
      matchId: match_id,
      predictedHomeScore: predicted_home_score,
      predictedAwayScore: predicted_away_score
    })

    const atomicResult = await atomicPredictionSubmission({
      userId: userId,
      matchId: match_id,
      predictedHomeScore: predicted_home_score,
      predictedAwayScore: predicted_away_score
    })

    console.log('Atomic result:', atomicResult)

    if (atomicResult.success && atomicResult.data) {
      return NextResponse.json<ApiResponse<Prediction>>({
        success: true,
        data: atomicResult.data
      }, { status: 201 })
    } else {
      // Handle specific error types
      const errorMessage = atomicResult.error || 'Failed to create prediction'
      console.error('Atomic prediction submission failed:', errorMessage)
      
      if (errorMessage.includes('no longer accepts predictions') || 
          errorMessage.includes('already started') ||
          errorMessage.includes('already exists')) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: errorMessage,
          data: null
        }, { status: 400 })
      }

      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: errorMessage,
        data: null
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Unexpected error in POST /api/predictions:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 })
  }
}