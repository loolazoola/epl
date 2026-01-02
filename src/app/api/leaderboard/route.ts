import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { LeaderboardEntry, PaginatedResponse } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('userId') // For highlighting user position
    
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json({
        success: false,
        error: 'Invalid pagination parameters'
      }, { status: 400 })
    }

    const offset = (page - 1) * limit

    // Get total count of users with predictions
    const { count: totalCount, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gt('total_points', -1) // Include all users (even with 0 points)

    if (countError) {
      throw countError
    }

    // Get leaderboard data with user stats using basic queries
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        avatar_url,
        total_points,
        created_at,
        updated_at
      `)
      .order('total_points', { ascending: false })
      .order('updated_at', { ascending: true }) // Tie-breaker: earlier registration
      .range(offset, offset + limit - 1)

    if (usersError) {
      throw usersError
    }

    if (!usersData) {
      return NextResponse.json({
        success: false,
        error: 'No users found'
      }, { status: 404 })
    }

    // Calculate stats for each user
    const leaderboardEntries: LeaderboardEntry[] = []
    
    for (let i = 0; i < usersData.length; i++) {
      const user = usersData[i] as any // Type assertion to work around Supabase typing issues
      
      // Get prediction stats for this user
      const { data: predictionStats, error: statsError } = await supabase
        .from('predictions')
        .select('points_earned, processed')
        .eq('user_id', user.id)
        .eq('processed', true)

      if (statsError) {
        console.error('Error fetching prediction stats for user:', user.id, statsError)
      }

      const totalPredictions = predictionStats?.length || 0
      const correctPredictions = predictionStats?.filter((p: any) => p.points_earned > 0).length || 0

      leaderboardEntries.push({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          total_points: user.total_points,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        rank: offset + i + 1,
        points: user.total_points,
        correct_predictions: correctPredictions,
        total_predictions: totalPredictions
      })
    }

    const response: PaginatedResponse<LeaderboardEntry> = {
      data: leaderboardEntries,
      success: true,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        has_more: (offset + limit) < (totalCount || 0)
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch leaderboard data'
    }, { status: 500 })
  }
}