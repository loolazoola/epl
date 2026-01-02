/**
 * Match cache utilities to avoid unnecessary API calls and syncing
 */

const CACHE_KEY = 'match_sync_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  timestamp: number;
  externalIds: string[];
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