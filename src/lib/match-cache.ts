/**
 * Match cache utilities to avoid unnecessary API calls and syncing
 */

const CACHE_KEY = 'match_sync_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  timestamp: number;
  externalIds: string[];
}

interface ParsedMatch {
  external_id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';
  kickoff_time: string;
  gameweek: number;
  season: string;
}

interface MatchCacheEntry {
  timestamp: number;
  data: ParsedMatch[];
  dateFrom?: string;
  dateTo?: string;
}

const matchCache = new Map<string, MatchCacheEntry>();

/**
 * Get cached matches or fetch from API
 */
export async function getCachedMatches(
  dateFrom?: string,
  dateTo?: string,
  forceRefresh = false
): Promise<{ data: ParsedMatch[] | null; error: string | null }> {
  const cacheKey = `matches_${dateFrom || 'all'}_${dateTo || 'all'}`;
  
  if (!forceRefresh && matchCache.has(cacheKey)) {
    const cached = matchCache.get(cacheKey)!;
    const now = Date.now();
    
    if (now - cached.timestamp < CACHE_DURATION) {
      return { data: cached.data, error: null };
    }
  }

  try {
    // Import dynamically to avoid circular dependency
    const { fetchPremierLeagueMatches } = await import('./football-api');
    const matches = await fetchPremierLeagueMatches(dateFrom, dateTo);
    
    // Cache the results
    matchCache.set(cacheKey, {
      timestamp: Date.now(),
      data: matches,
      dateFrom,
      dateTo
    });
    
    return { data: matches, error: null };
  } catch (error) {
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Failed to fetch matches' 
    };
  }
}

/**
 * Invalidate cache entries
 */
export function invalidateCache(dateFrom?: string, dateTo?: string): void {
  if (dateFrom && dateTo) {
    const cacheKey = `matches_${dateFrom}_${dateTo}`;
    matchCache.delete(cacheKey);
  } else {
    // Clear all cache entries
    matchCache.clear();
  }
}

/**
 * Clear cache (alias for invalidateCache)
 */
export function clearCache(): void {
  matchCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const entries = Array.from(matchCache.entries());
  const now = Date.now();
  
  return {
    totalEntries: entries.length,
    validEntries: entries.filter(([_, entry]) => 
      now - entry.timestamp < CACHE_DURATION
    ).length,
    oldestEntry: entries.length > 0 ? 
      Math.min(...entries.map(([_, entry]) => entry.timestamp)) : null,
    newestEntry: entries.length > 0 ? 
      Math.max(...entries.map(([_, entry]) => entry.timestamp)) : null,
    totalMatches: entries.reduce((sum, [_, entry]) => sum + entry.data.length, 0)
  };
}

/**
 * Check if we recently synced these matches
 */
export function shouldSkipSync(externalIds: string[]): boolean {
  if (typeof window === 'undefined') return false; // Server-side, don't cache
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;
    
    const cacheEntry: CacheEntry = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - cacheEntry.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return false;
    }
    
    // Check if we have all the required matches in cache
    const hasAllMatches = externalIds.every(id => 
      cacheEntry.externalIds.includes(id)
    );
    
    return hasAllMatches;
  } catch (error) {
    console.warn('Error checking match cache:', error);
    return false;
  }
}

/**
 * Mark these matches as recently synced
 */
export function markAsSynced(externalIds: string[]): void {
  if (typeof window === 'undefined') return; // Server-side, don't cache
  
  try {
    const cacheEntry: CacheEntry = {
      timestamp: Date.now(),
      externalIds: [...externalIds]
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn('Error updating match cache:', error);
  }
}

/**
 * Clear the match sync cache
 */
export function clearSyncCache(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Error clearing match cache:', error);
  }
}