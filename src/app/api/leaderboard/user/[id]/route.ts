import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { LeaderboardEntry, ApiResponse } from '@/types/database'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = createServerClient()
    const params = await context.params
    const userId = params.id

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    const user = userData as any // Type assertion to work around Supabase typing issues

    // Calculate user's rank by counting users with higher points
    const { count: higherRankedCount, error: rankError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gt('total_points', user.total_points)

    if (rankError) {
      throw rankError
    }

    // For tie-breaking, count users with same points but earlier registration
    const { count: samePointsEarlierCount, error: tieError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('total_points', user.total_points)
      .lt('updated_at', user.updated_at)

    if (tieError) {
      throw tieError
    }

    const userRank = (higherRankedCount || 0) + (samePointsEarlierCount || 0) + 1

    // Get user's prediction statistics
    const { data: predictionStats, error: statsError } = await supabase
      .from('predictions')
      .select('points_earned, processed')
      .eq('user_id', userId)
      .eq('processed', true)

    if (statsError) {
      console.error('Error fetching prediction stats:', statsError)
    }

    const totalPredictions = predictionStats?.length || 0
    const correctPredictions = predictionStats?.filter((p: any) => p.points_earned > 0).length || 0

    const leaderboardEntry: LeaderboardEntry = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        total_points: user.total_points,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      rank: userRank,
      points: user.total_points,
      correct_predictions: correctPredictions,
      total_predictions: totalPredictions
    }

    const response: ApiResponse<LeaderboardEntry> = {
      data: leaderboardEntry,
      success: true
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('User leaderboard API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user leaderboard data'
    }, { status: 500 })
  }
}