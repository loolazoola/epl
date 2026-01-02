import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { ApiResponse, Prediction } from '@/types/database'
import { logError } from '@/lib/error-handling'

// GET /api/predictions/match/[matchId] - Get user's prediction for specific match
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Authentication required',
        data: null
      }, { status: 401 })
    }

    const { matchId } = await params

    if (!matchId) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Match ID is required',
        data: null
      }, { status: 400 })
    }

    const supabase = createServerClient()

    // Get user ID from email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (userError || !userData) {
      logError(userError || new Error('User not found'), {
        email: session.user.email,
        operation: 'getUserForPredictionRetrieval'
      })
      
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'User not found',
        data: null
      }, { status: 404 })
    }

    const user = userData as any

    // Get user's prediction for the specific match
    const { data: prediction, error } = await supabase
      .from('predictions')
      .select(`
        *,
        match:matches(*)
      `)
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .single()

    if (error) {
      // If no prediction found, return null data (not an error)
      if (error.code === 'PGRST116') {
        return NextResponse.json<ApiResponse<null>>({
          success: true,
          data: null
        })
      }

      logError(error, {
        userId: user.id,
        matchId,
        operation: 'getPredictionForMatch'
      })

      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to fetch prediction',
        data: null
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<Prediction>>({
      success: true,
      data: prediction
    })

  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      operation: 'GET /api/predictions/match/[matchId]'
    })
    
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 })
  }
}