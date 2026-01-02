import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { LeaderboardEntry, PaginatedResponse } from '@/types/database'

interface UseLeaderboardOptions {
  page?: number
  limit?: number
  userId?: string
  autoRefresh?: boolean
}

interface UseLeaderboardReturn {
  data: LeaderboardEntry[]
  loading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    has_more: boolean
  } | null
  userPosition: LeaderboardEntry | null
  refresh: () => Promise<void>
  nextPage: () => void
  prevPage: () => void
}

export function useLeaderboard(options: UseLeaderboardOptions = {}): UseLeaderboardReturn {
  const {
    page: initialPage = 1,
    limit = 20,
    userId,
    autoRefresh = true
  } = options

  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    total: number
    has_more: boolean
  } | null>(null)
  const [userPosition, setUserPosition] = useState<LeaderboardEntry | null>(null)
  const [currentPage, setCurrentPage] = useState(initialPage)

  const fetchLeaderboard = useCallback(async (pageNum: number = currentPage) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString()
      })

      if (userId) {
        params.append('userId', userId)
      }

      const response = await fetch(`/api/leaderboard?${params}`)
      const result: PaginatedResponse<LeaderboardEntry> = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch leaderboard')
      }

      setData(result.data)
      setPagination(result.pagination)

      // Fetch user position if userId is provided
      if (userId) {
        const userResponse = await fetch(`/api/leaderboard/user/${userId}`)
        const userResult = await userResponse.json()
        
        if (userResult.success) {
          setUserPosition(userResult.data)
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Leaderboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, limit, userId])

  const refresh = useCallback(() => fetchLeaderboard(currentPage), [fetchLeaderboard, currentPage])

  const nextPage = useCallback(() => {
    if (pagination?.has_more) {
      const newPage = currentPage + 1
      setCurrentPage(newPage)
      fetchLeaderboard(newPage)
    }
  }, [currentPage, pagination?.has_more, fetchLeaderboard])

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1
      setCurrentPage(newPage)
      fetchLeaderboard(newPage)
    }
  }, [currentPage, fetchLeaderboard])

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard(currentPage)
  }, []) // Only run on mount

  // Set up real-time subscriptions for user points updates
  useEffect(() => {
    if (!autoRefresh) return

    let subscription: any = null

    const setupRealtimeSubscription = async () => {
      try {
        // Subscribe to changes in users table (total_points updates)
        subscription = supabase
          .channel('leaderboard-updates')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'users',
              filter: 'total_points=neq.null'
            },
            (payload) => {
              console.log('User points updated:', payload)
              // Refresh leaderboard when any user's points change
              refresh()
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'users'
            },
            (payload) => {
              console.log('New user registered:', payload)
              // Refresh leaderboard when new user joins
              refresh()
            }
          )
          .subscribe((status) => {
            console.log('Leaderboard subscription status:', status)
            if (status === 'SUBSCRIBED') {
              console.log('Successfully subscribed to leaderboard updates')
            }
          })

      } catch (err) {
        console.error('Failed to set up real-time subscription:', err)
      }
    }

    setupRealtimeSubscription()

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [autoRefresh, refresh])

  // Handle connection state changes
  useEffect(() => {
    if (!autoRefresh) return

    const handleConnectionChange = (status: string) => {
      console.log('Supabase connection status:', status)
      
      if (status === 'CLOSED') {
        setError('Connection lost. Attempting to reconnect...')
      } else if (status === 'SUBSCRIBED') {
        setError(null)
        // Refresh data when reconnected
        refresh()
      }
    }

    // Listen for connection state changes
    const channel = supabase.channel('connection-status')
    channel.subscribe(handleConnectionChange)

    return () => {
      supabase.removeChannel(channel)
    }
  }, [autoRefresh, refresh])

  return {
    data,
    loading,
    error,
    pagination,
    userPosition,
    refresh,
    nextPage,
    prevPage
  }
}