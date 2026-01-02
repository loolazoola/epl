import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { ApiResponse, Prediction } from '@/types/database'

// GET /api/predictions/[id] - Get specific prediction
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    const params = await context.params
    const supabase = createServerClient()

    // Get user ID from email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (userError || !userData) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'User not found',
        data: null
      }, { status: 404 })
    }

    const user = userData as any // Type assertion to work around Supabase typing issues

    // Get prediction with match details
    const { data: prediction, error } = await supabase
      .from('predictions')
      .select(`
        *,
        match:matches(*)
      `)
      .eq('id', params.id)
      .eq('user_id', user.id) // Ensure user can only access their own predictions
      .single()

    if (error || !prediction) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Prediction not found',
        data: null
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse<Prediction>>({
      success: true,
      data: prediction
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/predictions/[id]:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 })
  }
}

// PUT /api/predictions/[id] - Update existing prediction
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    const params = await context.params
    const body = await request.json()
    const { predicted_home_score, predicted_away_score } = body
    const supabase = createServerClient()

    // Validate input
    if (predicted_home_score === undefined || predicted_away_score === undefined) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Missing required fields: predicted_home_score, predicted_away_score',
        data: null
      }, { status: 400 })
    }

    // Validate score ranges (0-20 goals)
    if (predicted_home_score < 0 || predicted_home_score > 20 || 
        predicted_away_score < 0 || predicted_away_score > 20) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Predicted scores must be between 0 and 20',
        data: null
      }, { status: 400 })
    }

    // Get user ID from email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (userError || !userData) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'User not found',
        data: null
      }, { status: 404 })
    }

    const user = userData as any // Type assertion to work around Supabase typing issues

    // Get existing prediction with match details
    const { data: existingPredictionData, error: predictionError } = await supabase
      .from('predictions')
      .select(`
        *,
        match:matches(*)
      `)
      .eq('id', params.id)
      .eq('user_id', user.id) // Ensure user can only update their own predictions
      .single()

    if (predictionError || !existingPredictionData) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Prediction not found',
        data: null
      }, { status: 404 })
    }

    const existingPrediction = existingPredictionData as any // Type assertion to work around Supabase typing issues

    // Validate match timing - prevent updates within 2 hours of kickoff or after match starts
    const now = new Date()
    const kickoffTime = new Date(existingPrediction.match.kickoff_time)
    const twoHoursBeforeKickoff = new Date(kickoffTime.getTime() - (2 * 60 * 60 * 1000))
    
    if (now >= twoHoursBeforeKickoff || existingPrediction.match.status !== 'TIMED') {
      const timeUntilKickoff = kickoffTime.getTime() - now.getTime()
      const hoursUntilKickoff = Math.floor(timeUntilKickoff / (1000 * 60 * 60))
      
      if (now >= kickoffTime) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Cannot update predictions for matches that have started or finished',
          data: null
        }, { status: 400 })
      } else {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `Predictions are locked within 2 hours of kickoff. This match kicks off in ${hoursUntilKickoff < 2 ? 'less than 2 hours' : `${hoursUntilKickoff} hours`}.`,
          data: null
        }, { status: 400 })
      }
    }

    // Prevent updates if prediction has already been processed
    if (existingPrediction.processed) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Cannot update processed predictions',
        data: null
      }, { status: 400 })
    }

    // Update prediction
    const updateData = {
      predicted_home_score: parseInt(predicted_home_score),
      predicted_away_score: parseInt(predicted_away_score),
      updated_at: new Date().toISOString()
    }
    
    const { data: updatedPrediction, error: updateError } = await (supabase as any)
      .from('predictions')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating prediction:', updateError)
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to update prediction',
        data: null
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<Prediction>>({
      success: true,
      data: updatedPrediction
    })

  } catch (error) {
    console.error('Unexpected error in PUT /api/predictions/[id]:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 })
  }
}

// DELETE /api/predictions/[id] - Delete prediction (before match starts)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    const params = await context.params
    const supabase = createServerClient()

    // Get user ID from email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (userError || !userData) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'User not found',
        data: null
      }, { status: 404 })
    }

    const user = userData as any // Type assertion to work around Supabase typing issues

    // Get existing prediction with match details
    const { data: existingPredictionData, error: predictionError } = await supabase
      .from('predictions')
      .select(`
        *,
        match:matches(*)
      `)
      .eq('id', params.id)
      .eq('user_id', user.id) // Ensure user can only delete their own predictions
      .single()

    if (predictionError || !existingPredictionData) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Prediction not found',
        data: null
      }, { status: 404 })
    }

    const existingPrediction = existingPredictionData as any // Type assertion to work around Supabase typing issues

    // Validate match timing - prevent deletion within 2 hours of kickoff or after match starts
    const now = new Date()
    const kickoffTime = new Date(existingPrediction.match.kickoff_time)
    const twoHoursBeforeKickoff = new Date(kickoffTime.getTime() - (2 * 60 * 60 * 1000))
    
    if (now >= twoHoursBeforeKickoff || existingPrediction.match.status !== 'TIMED') {
      const timeUntilKickoff = kickoffTime.getTime() - now.getTime()
      const hoursUntilKickoff = Math.floor(timeUntilKickoff / (1000 * 60 * 60))
      
      if (now >= kickoffTime) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: 'Cannot delete predictions for matches that have started or finished',
          data: null
        }, { status: 400 })
      } else {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `Predictions are locked within 2 hours of kickoff. This match kicks off in ${hoursUntilKickoff < 2 ? 'less than 2 hours' : `${hoursUntilKickoff} hours`}.`,
          data: null
        }, { status: 400 })
      }
    }

    // Prevent deletion if prediction has already been processed
    if (existingPrediction.processed) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Cannot delete processed predictions',
        data: null
      }, { status: 400 })
    }

    // Delete prediction
    const { error: deleteError } = await supabase
      .from('predictions')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting prediction:', deleteError)
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to delete prediction',
        data: null
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null
    })

  } catch (error) {
    console.error('Unexpected error in DELETE /api/predictions/[id]:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 })
  }
}