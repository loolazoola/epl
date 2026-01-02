// Match data synchronization service with API rate limiting and error recovery
import { getCachedMatches, invalidateCache } from './match-cache'
import { createServerClient } from '@/lib/supabase'
import type { ParsedMatch } from './football-api'

interface SyncResult {
  newMatches: number
  updatedMatches: number
  totalMatches: number
  errors: string[]
}

interface DatabaseMatch {
  id: string
  external_id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED'
  kickoff_time: string
  gameweek: number | null
  season: string
  created_at: string
  updated_at: string
}

/**
 * Sync match data from external API to database
 * Handles API rate limiting and error recovery
 */
export async function syncMatchData(): Promise<SyncResult> {
  const result: SyncResult = {
    newMatches: 0,
    updatedMatches: 0,
    totalMatches: 0,
    errors: []
  }

  const supabase = createServerClient()

  try {
    // Force refresh cache to get latest data from API
    console.log('Fetching latest match data from API...')
    const apiResponse = await getCachedMatches(undefined, undefined, true)

    if (apiResponse.error || !apiResponse.data) {
      result.errors.push(`Failed to fetch match data: ${apiResponse.error}`)
      return result
    }

    const apiMatches = apiResponse.data
    result.totalMatches = apiMatches.length

    console.log(`Fetched ${apiMatches.length} matches from API`)

    // Get existing matches from database
    const { data: existingMatches, error: dbError } = await supabase
      .from('matches')
      .select('*')

    if (dbError) {
      result.errors.push(`Database error: ${dbError.message}`)
      return result
    }

    // Create a map of existing matches by external_id for quick lookup
    const existingMatchesMap = new Map<string, DatabaseMatch>()
    if (existingMatches) {
      existingMatches.forEach((match: any) => {
        existingMatchesMap.set(match.external_id, match)
      })
    }

    // Process each match from API
    for (const apiMatch of apiMatches) {
      try {
        const existingMatch = existingMatchesMap.get(apiMatch.external_id)

        if (existingMatch) {
          // Check if match needs updating
          const needsUpdate = (
            existingMatch.home_score !== apiMatch.home_score ||
            existingMatch.away_score !== apiMatch.away_score ||
            existingMatch.status !== apiMatch.status ||
            existingMatch.kickoff_time !== apiMatch.kickoff_time ||
            existingMatch.gameweek !== apiMatch.gameweek
          )

          if (needsUpdate) {
            console.log(`Updating match: ${apiMatch.home_team} vs ${apiMatch.away_team}`)
            
            const updateData = {
              home_score: apiMatch.home_score,
              away_score: apiMatch.away_score,
              status: apiMatch.status,
              kickoff_time: apiMatch.kickoff_time,
              gameweek: apiMatch.gameweek,
              season: apiMatch.season
            }

            const { error: updateError } = await (supabase as any)
              .from('matches')
              .update(updateData)
              .eq('external_id', apiMatch.external_id)

            if (updateError) {
              result.errors.push(`Failed to update match ${apiMatch.external_id}: ${updateError.message}`)
            } else {
              result.updatedMatches++
              
              // Invalidate cache for this match date to ensure fresh data
              invalidateCache()
            }
          }
        } else {
          // Insert new match
          console.log(`Inserting new match: ${apiMatch.home_team} vs ${apiMatch.away_team}`)
          
          const insertData = {
            external_id: apiMatch.external_id,
            home_team: apiMatch.home_team,
            away_team: apiMatch.away_team,
            home_score: apiMatch.home_score,
            away_score: apiMatch.away_score,
            status: apiMatch.status,
            kickoff_time: apiMatch.kickoff_time,
            gameweek: apiMatch.gameweek,
            season: apiMatch.season
          }

          const { error: insertError } = await (supabase as any)
            .from('matches')
            .insert(insertData)

          if (insertError) {
            result.errors.push(`Failed to insert match ${apiMatch.external_id}: ${insertError.message}`)
          } else {
            result.newMatches++
          }
        }
      } catch (matchError) {
        const errorMessage = matchError instanceof Error ? matchError.message : 'Unknown error'
        result.errors.push(`Error processing match ${apiMatch.external_id}: ${errorMessage}`)
      }
    }

    // Invalidate cache after successful sync to ensure fresh data for users
    if (result.newMatches > 0 || result.updatedMatches > 0) {
      invalidateCache()
      console.log('Cache invalidated after successful sync')
    }

    console.log(`Sync completed: ${result.newMatches} new, ${result.updatedMatches} updated`)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Sync process failed: ${errorMessage}`)
    console.error('Match sync failed:', error)
  }

  return result
}

/**
 * Sync matches for a specific date range
 * Useful for targeted updates or backfilling data
 */
export async function syncMatchDataForDateRange(
  dateFrom: string,
  dateTo: string
): Promise<SyncResult> {
  const result: SyncResult = {
    newMatches: 0,
    updatedMatches: 0,
    totalMatches: 0,
    errors: []
  }

  const supabase = createServerClient()

  try {
    console.log(`Syncing matches from ${dateFrom} to ${dateTo}`)
    
    // Fetch matches for specific date range
    const apiResponse = await getCachedMatches(dateFrom, dateTo, true)

    if (apiResponse.error || !apiResponse.data) {
      result.errors.push(`Failed to fetch match data for date range: ${apiResponse.error}`)
      return result
    }

    const apiMatches = apiResponse.data
    result.totalMatches = apiMatches.length

    console.log(`Fetched ${apiMatches.length} matches for date range`)

    // Get existing matches for this date range
    const { data: existingMatches, error: dbError } = await supabase
      .from('matches')
      .select('*')
      .gte('kickoff_time', dateFrom)
      .lte('kickoff_time', dateTo)

    if (dbError) {
      result.errors.push(`Database error: ${dbError.message}`)
      return result
    }

    // Create a map of existing matches by external_id
    const existingMatchesMap = new Map<string, DatabaseMatch>()
    if (existingMatches) {
      existingMatches.forEach((match: any) => {
        existingMatchesMap.set(match.external_id, match)
      })
    }

    // Process each match
    for (const apiMatch of apiMatches) {
      try {
        const existingMatch = existingMatchesMap.get(apiMatch.external_id)

        if (existingMatch) {
          // Update existing match if needed
          const needsUpdate = (
            existingMatch.home_score !== apiMatch.home_score ||
            existingMatch.away_score !== apiMatch.away_score ||
            existingMatch.status !== apiMatch.status ||
            existingMatch.kickoff_time !== apiMatch.kickoff_time
          )

          if (needsUpdate) {
            const updateData = {
              home_score: apiMatch.home_score,
              away_score: apiMatch.away_score,
              status: apiMatch.status,
              kickoff_time: apiMatch.kickoff_time,
              gameweek: apiMatch.gameweek,
              season: apiMatch.season
            }

            const { error: updateError } = await (supabase as any)
              .from('matches')
              .update(updateData)
              .eq('external_id', apiMatch.external_id)

            if (updateError) {
              result.errors.push(`Failed to update match ${apiMatch.external_id}: ${updateError.message}`)
            } else {
              result.updatedMatches++
            }
          }
        } else {
          // Insert new match
          const insertData = {
            external_id: apiMatch.external_id,
            home_team: apiMatch.home_team,
            away_team: apiMatch.away_team,
            home_score: apiMatch.home_score,
            away_score: apiMatch.away_score,
            status: apiMatch.status,
            kickoff_time: apiMatch.kickoff_time,
            gameweek: apiMatch.gameweek,
            season: apiMatch.season
          }

          const { error: insertError } = await (supabase as any)
            .from('matches')
            .insert(insertData)

          if (insertError) {
            result.errors.push(`Failed to insert match ${apiMatch.external_id}: ${insertError.message}`)
          } else {
            result.newMatches++
          }
        }
      } catch (matchError) {
        const errorMessage = matchError instanceof Error ? matchError.message : 'Unknown error'
        result.errors.push(`Error processing match ${apiMatch.external_id}: ${errorMessage}`)
      }
    }

    // Invalidate relevant cache entries
    if (result.newMatches > 0 || result.updatedMatches > 0) {
      invalidateCache(dateFrom, dateTo)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Date range sync failed: ${errorMessage}`)
  }

  return result
}

/**
 * Get sync status and statistics
 */
export async function getSyncStatus() {
  const supabase = createServerClient()

  try {
    // Get total matches count
    const { count: totalMatches, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      throw new Error(`Failed to get match count: ${countError.message}`)
    }

    // Get matches by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('matches')
      .select('status')

    if (statusError) {
      throw new Error(`Failed to get status counts: ${statusError.message}`)
    }

    const statusBreakdown = statusCounts?.reduce((acc: Record<string, number>, match: any) => {
      acc[match.status] = (acc[match.status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Get latest match update
    const { data: latestMatch, error: latestError } = await supabase
      .from('matches')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (latestError) {
      throw new Error(`Failed to get latest match: ${latestError.message}`)
    }

    return {
      totalMatches: totalMatches || 0,
      statusBreakdown,
      lastUpdated: (latestMatch?.[0] as any)?.updated_at || null
    }

  } catch (error) {
    console.error('Failed to get sync status:', error)
    throw error
  }
}