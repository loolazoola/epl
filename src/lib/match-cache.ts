// Match data caching system with proper field mapping and cache invalidation
import { ParsedMatch, getPremierLeagueMatches, ApiResponse } from './football-api';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_CACHE_SIZE = 1000; // Maximum number of cached matches

interface CacheEntry {
  data: ParsedMatch[];
  timestamp: number;
  key: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  lastUpdated: number | null;
}

// In-memory cache storage
const cache = new Map<string, CacheEntry>();
const stats: CacheStats = {
  hits: 0,
  misses: 0,
  size: 0,
  lastUpdated: null,
};

/**
 * Generate cache key from parameters
 */
function generateCacheKey(dateFrom?: string, dateTo?: string): string {
  const params = [];
  if (dateFrom) params.push(`from:${dateFrom}`);
  if (dateTo) params.push(`to:${dateTo}`);
  return params.length > 0 ? params.join('|') : 'all-matches';
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  const now = Date.now();
  return (now - entry.timestamp) < CACHE_DURATION;
}

/**
 * Clean expired entries from cache
 */
function cleanExpiredEntries(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];
  
  for (const [key, entry] of cache.entries()) {
    if ((now - entry.timestamp) >= CACHE_DURATION) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => cache.delete(key));
  stats.size = cache.size;
}

/**
 * Enforce cache size limits by removing oldest entries
 */
function enforceCacheSize(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;
  
  // Convert to array and sort by timestamp (oldest first)
  const entries = Array.from(cache.entries()).sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );
  
  // Remove oldest entries until we're under the limit
  const entriesToRemove = cache.size - MAX_CACHE_SIZE;
  for (let i = 0; i < entriesToRemove; i++) {
    cache.delete(entries[i][0]);
  }
  
  stats.size = cache.size;
}

/**
 * Get matches from cache or fetch from API
 */
export async function getCachedMatches(
  dateFrom?: string,
  dateTo?: string,
  forceRefresh = false
): Promise<ApiResponse<ParsedMatch[]>> {
  const cacheKey = generateCacheKey(dateFrom, dateTo);
  
  // Clean expired entries periodically
  cleanExpiredEntries();
  
  // Check cache first (unless force refresh is requested)
  if (!forceRefresh && cache.has(cacheKey)) {
    const entry = cache.get(cacheKey)!;
    
    if (isCacheValid(entry)) {
      stats.hits++;
      console.log(`Cache hit for key: ${cacheKey}`);
      return {
        data: entry.data,
        error: null,
        status: 200,
        cached: true,
      };
    } else {
      // Remove expired entry
      cache.delete(cacheKey);
      stats.size = cache.size;
    }
  }
  
  // Cache miss - fetch from API
  stats.misses++;
  console.log(`Cache miss for key: ${cacheKey}, fetching from API`);
  
  const response = await getPremierLeagueMatches(dateFrom, dateTo);
  
  // Cache successful responses
  if (response.data && !response.error) {
    const entry: CacheEntry = {
      data: response.data,
      timestamp: Date.now(),
      key: cacheKey,
    };
    
    cache.set(cacheKey, entry);
    stats.size = cache.size;
    stats.lastUpdated = entry.timestamp;
    
    // Enforce cache size limits
    enforceCacheSize();
    
    console.log(`Cached ${response.data.length} matches for key: ${cacheKey}`);
  }
  
  return response;
}

/**
 * Invalidate specific cache entries
 */
export function invalidateCache(dateFrom?: string, dateTo?: string): void {
  if (dateFrom || dateTo) {
    // Invalidate specific cache entry
    const cacheKey = generateCacheKey(dateFrom, dateTo);
    const deleted = cache.delete(cacheKey);
    if (deleted) {
      console.log(`Invalidated cache for key: ${cacheKey}`);
      stats.size = cache.size;
    }
  } else {
    // Invalidate all cache entries
    const size = cache.size;
    cache.clear();
    stats.size = 0;
    console.log(`Invalidated entire cache (${size} entries removed)`);
  }
}

/**
 * Invalidate cache entries that might contain a specific match
 */
export function invalidateCacheForMatch(matchDate: string): void {
  const keysToInvalidate: string[] = [];
  
  for (const [key, entry] of cache.entries()) {
    // Check if any cached match matches the date
    const hasMatchOnDate = entry.data.some(match => {
      const matchDateOnly = match.kickoff_time.split('T')[0];
      const targetDateOnly = matchDate.split('T')[0];
      return matchDateOnly === targetDateOnly;
    });
    
    if (hasMatchOnDate) {
      keysToInvalidate.push(key);
    }
  }
  
  keysToInvalidate.forEach(key => {
    cache.delete(key);
    console.log(`Invalidated cache for key containing match date: ${key}`);
  });
  
  stats.size = cache.size;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return { ...stats };
}

/**
 * Warm up cache with common queries
 */
export async function warmUpCache(): Promise<void> {
  console.log('Warming up match cache...');
  
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const dateFrom = oneWeekAgo.toISOString().split('T')[0];
  const dateTo = oneWeekFromNow.toISOString().split('T')[0];
  
  try {
    // Cache recent and upcoming matches
    await getCachedMatches(dateFrom, dateTo);
    
    // Cache all matches for current season
    await getCachedMatches();
    
    console.log('Cache warm-up completed');
  } catch (error) {
    console.error('Cache warm-up failed:', error);
  }
}

/**
 * Clear all cache data (useful for testing)
 */
export function clearCache(): void {
  cache.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.size = 0;
  stats.lastUpdated = null;
  console.log('Cache cleared');
}

/**
 * Get all cached match data (for debugging)
 */
export function getAllCachedData(): Array<{ key: string; data: ParsedMatch[]; timestamp: number }> {
  return Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    data: entry.data,
    timestamp: entry.timestamp,
  }));
}