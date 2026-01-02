import { supabase, createServerClient } from './supabase'
import { User, Match, Prediction, Database } from '@/types/database'
import { dbErrorHandler } from './error-handling'

// User operations
export const userOperations = {
  async getById(id: string): Promise<User | null> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    })
  },

  async getByEmail(email: string): Promise<User | null> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    })
  },

  async create(user: Database['public']['Tables']['users']['Insert']): Promise<User> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await (supabase as any)
        .from('users')
        .insert(user)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  },

  async updatePoints(id: string, points: number): Promise<User> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await (supabase as any)
        .from('users')
        .update({ total_points: points })
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  },

  async getLeaderboard(limit: number = 50): Promise<User[]> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data
    })
  }
}

// Match operations
export const matchOperations = {
  async getAll(): Promise<Match[]> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('kickoff_time', { ascending: true })
      
      if (error) throw error
      return data
    })
  },

  async getById(id: string): Promise<Match | null> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    })
  },

  async getByExternalId(externalId: string): Promise<Match | null> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('external_id', externalId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    })
  },

  async getUpcoming(): Promise<Match[]> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'TIMED')
        .gt('kickoff_time', new Date().toISOString())
        .order('kickoff_time', { ascending: true })
      
      if (error) throw error
      return data
    })
  },

  async getFinished(): Promise<Match[]> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'FINISHED')
        .order('kickoff_time', { ascending: false })
      
      if (error) throw error
      return data
    })
  },

  async create(match: Database['public']['Tables']['matches']['Insert']): Promise<Match> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await (supabase as any)
        .from('matches')
        .insert(match)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  },

  async update(id: string, updates: Database['public']['Tables']['matches']['Update']): Promise<Match> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await (supabase as any)
        .from('matches')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  }
}

// Prediction operations
export const predictionOperations = {
  async getByUserId(userId: string): Promise<Prediction[]> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('predictions')
        .select(`
          *,
          match:matches(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    })
  },

  async getByMatchId(matchId: string): Promise<Prediction[]> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', matchId)
      
      if (error) throw error
      return data
    })
  },

  async getByUserAndMatch(userId: string, matchId: string): Promise<Prediction | null> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)
        .eq('match_id', matchId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    })
  },

  async create(prediction: Database['public']['Tables']['predictions']['Insert']): Promise<Prediction> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await (supabase as any)
        .from('predictions')
        .insert(prediction)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  },

  async update(id: string, updates: Database['public']['Tables']['predictions']['Update']): Promise<Prediction> {
    return dbErrorHandler.execute(async () => {
      const { data, error } = await (supabase as any)
        .from('predictions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  },

  async delete(id: string): Promise<void> {
    return dbErrorHandler.execute(async () => {
      const { error } = await supabase
        .from('predictions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    })
  },

  async getUnprocessedForMatch(matchId: string): Promise<Prediction[]> {
    return dbErrorHandler.execute(async () => {
      const serverClient = createServerClient()
      const { data, error } = await serverClient
        .from('predictions')
        .select('*')
        .eq('match_id', matchId)
        .eq('processed', false)
      
      if (error) throw error
      return data
    })
  },

  async markAsProcessed(id: string, pointsEarned: number): Promise<Prediction> {
    return dbErrorHandler.execute(async () => {
      const serverClient = createServerClient()
      const { data, error } = await (serverClient as any)
        .from('predictions')
        .update({ 
          processed: true, 
          points_earned: pointsEarned 
        })
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  }
}

// Real-time subscriptions
export const subscriptions = {
  subscribeToLeaderboard(callback: (users: User[]) => void) {
    return supabase
      .channel('leaderboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        async () => {
          // Refetch leaderboard data when users table changes
          const users = await userOperations.getLeaderboard()
          callback(users)
        }
      )
      .subscribe()
  },

  subscribeToMatches(callback: (matches: Match[]) => void) {
    return supabase
      .channel('matches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches'
        },
        async () => {
          // Refetch matches when matches table changes
          const matches = await matchOperations.getAll()
          callback(matches)
        }
      )
      .subscribe()
  },

  subscribeToUserPredictions(userId: string, callback: (predictions: Prediction[]) => void) {
    return supabase
      .channel(`predictions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
          filter: `user_id=eq.${userId}`
        },
        async () => {
          // Refetch user predictions when their predictions change
          const predictions = await predictionOperations.getByUserId(userId)
          callback(predictions)
        }
      )
      .subscribe()
  }
}