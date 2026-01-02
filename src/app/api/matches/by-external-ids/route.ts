import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { ApiResponse } from '@/types/database'

// POST /api/matches/by-external-ids - Get database matches by external IDs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { external_ids } = body

    if (!external_ids || !Array.isArray(external_ids)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'external_ids array is required',
        data: null
      }, { status: 400 })
    }

    const supabase = createServerClient()

    // Get matches from database by external IDs
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .in('external_id', external_ids)

    if (error) {
      console.error('Error fetching matches by external IDs:', error)
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to fetch matches',
        data: null
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<any[]>>({
      success: true,
      data: matches || []
    })

  } catch (error) {
    console.error('Unexpected error in POST /api/matches/by-external-ids:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 })
  }
}