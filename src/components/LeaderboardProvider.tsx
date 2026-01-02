'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LeaderboardEntry } from '@/types/database'

interface LeaderboardContextType {
  topUsers: LeaderboardEntry[]
  isConnected: boolean
  connectionError: string | null
  refreshLeaderboard: () => void
}

const LeaderboardContext = createContext<LeaderboardContextType | undefined>(undefined)

interface LeaderboardProviderProps {
  children: React.ReactNode
  topCount?: number
}

export function LeaderboardProvider({ children, topCount = 10 }: LeaderboardProviderProps) {
  const [topUsers, setTopUsers] = useState<LeaderboardEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const fetchTopUsers = async () => {
    try {
      const response = await fetch(`/api/leaderboard?limit=${topCount}`)
      const result = await response.json()
      
      if (result.success) {
        setTopUsers(result.data)
        setConnectionError(null)
      } else {
        setConnectionError(result.error || 'Failed to fetch leaderboard')
      }
    } catch (error) {
      console.error('Error fetching top users:', error)
      setConnectionError('Network error')
    }
  }

  const refreshLeaderboard = () => {
    fetchTopUsers()
  }

  useEffect(() => {
    // Initial fetch
    fetchTopUsers()

    // Set up real-time subscription
    const channel = supabase
      .channel('global-leaderboard')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: 'total_points=neq.null'
        },
        (payload) => {
          console.log('Global leaderboard update:', payload)
          
          // Update the specific user in our local state if they're in top users
          const updatedUser = payload.new as any
          setTopUsers(current => {
            const userIndex = current.findIndex(entry => entry.user.id === updatedUser.id)
            
            if (userIndex >= 0) {
              // User is in current top list, update their data
              const updated = [...current]
              updated[userIndex] = {
                ...updated[userIndex],
                user: { ...updated[userIndex].user, ...updatedUser },
                points: updatedUser.total_points
              }
              
              // Re-sort by points (descending) and updated_at (ascending for tie-breaking)
              updated.sort((a, b) => {
                if (a.points !== b.points) {
                  return b.points - a.points
                }
                return new Date(a.user.updated_at).getTime() - new Date(b.user.updated_at).getTime()
              })
              
              // Update ranks
              return updated.map((entry, index) => ({
                ...entry,
                rank: index + 1
              }))
            } else {
              // User might have entered the top list, refresh to be sure
              fetchTopUsers()
              return current
            }
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users'
        },
        () => {
          // New user registered, refresh leaderboard
          fetchTopUsers()
        }
      )
      .subscribe((status) => {
        console.log('Global leaderboard subscription status:', status)
        setIsConnected(status === 'SUBSCRIBED')
        
        if (status === 'CLOSED') {
          setConnectionError('Real-time connection lost')
        } else if (status === 'SUBSCRIBED') {
          setConnectionError(null)
        }
      })

    // Cleanup
    return () => {
      supabase.removeChannel(channel)
    }
  }, [topCount])

  // Handle reconnection attempts
  useEffect(() => {
    if (connectionError && !isConnected) {
      const reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect...')
        fetchTopUsers()
      }, 5000) // Retry after 5 seconds

      return () => clearTimeout(reconnectTimer)
    }
  }, [connectionError, isConnected])

  const value: LeaderboardContextType = {
    topUsers,
    isConnected,
    connectionError,
    refreshLeaderboard
  }

  return (
    <LeaderboardContext.Provider value={value}>
      {children}
    </LeaderboardContext.Provider>
  )
}

export function useLeaderboardContext() {
  const context = useContext(LeaderboardContext)
  if (context === undefined) {
    throw new Error('useLeaderboardContext must be used within a LeaderboardProvider')
  }
  return context
}