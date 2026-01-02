// Football-Data.org API service with rate limiting and error handling
const FOOTBALL_API_BASE_URL = process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4';

// Premier League competition ID
const PREMIER_LEAGUE_ID = 2021;

// Rate limiting configuration (10 requests per minute for free tier)
const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const RETRY_DELAY_BASE = 1000; // Base delay for exponential backoff
const MAX_RETRIES = 3;

// Rate limiting state
let requestCount = 0;
let windowStart = Date.now();

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
  cached?: boolean;
}

interface Competition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
}

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED';
  matchday: number;
  homeTeam: {
    id: number;
    name: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    crest: string;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}

interface MatchesResponse {
  matches: FootballDataMatch[];
  count: number;
}

// Parsed match data for our application
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

/**
 * Check if we're within rate limits
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  
  // Reset window if it has passed
  if (now - windowStart >= RATE_LIMIT_WINDOW) {
    requestCount = 0;
    windowStart = now;
  }
  
  return requestCount < RATE_LIMIT_REQUESTS;
}

/**
 * Wait for rate limit window to reset
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeUntilReset = RATE_LIMIT_WINDOW - (now - windowStart);
  
  if (timeUntilReset > 0) {
    console.log(`Rate limit exceeded. Waiting ${timeUntilReset}ms for reset.`);
    await new Promise(resolve => setTimeout(resolve, timeUntilReset));
    requestCount = 0;
    windowStart = Date.now();
  }
}

/**
 * Exponential backoff delay
 */
async function exponentialBackoff(attempt: number): Promise<void> {
  const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
  console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Make a request to the Football-Data.org API with rate limiting and retry logic
 */
async function makeApiRequest<T>(endpoint: string, retryCount = 0): Promise<ApiResponse<T>> {
  const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
  
  if (!FOOTBALL_API_KEY) {
    return {
      data: null,
      error: 'Football Data API key is not configured',
      status: 0,
    };
  }

  // Check rate limits
  if (!checkRateLimit()) {
    await waitForRateLimit();
  }

  try {
    const url = `${FOOTBALL_API_BASE_URL}${endpoint}`;
    console.log(`Making API request to: ${url} (attempt ${retryCount + 1})`);

    requestCount++;
    
    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': FOOTBALL_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log('API Response status:', response.status);

    // Handle rate limiting from server
    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        await exponentialBackoff(retryCount);
        return makeApiRequest<T>(endpoint, retryCount + 1);
      } else {
        return {
          data: null,
          error: 'Rate limit exceeded and max retries reached',
          status: 429,
        };
      }
    }

    // Handle server errors with retry
    if (response.status >= 500 && retryCount < MAX_RETRIES) {
      await exponentialBackoff(retryCount);
      return makeApiRequest<T>(endpoint, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      
      return {
        data: null,
        error: `API Error: ${response.status} - ${errorText}`,
        status: response.status,
      };
    }

    const data = await response.json();
    console.log('API Response received successfully');

    return {
      data,
      error: null,
      status: response.status,
    };
  } catch (error) {
    console.error('Network error:', error);
    
    // Retry on network errors
    if (retryCount < MAX_RETRIES) {
      await exponentialBackoff(retryCount);
      return makeApiRequest<T>(endpoint, retryCount + 1);
    }
    
    return {
      data: null,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 0,
    };
  }
}

/**
 * Parse Football-Data.org match data to our application format
 */
function parseMatchData(match: FootballDataMatch): ParsedMatch {
  // Determine current season based on match date
  const matchDate = new Date(match.utcDate);
  const year = matchDate.getFullYear();
  const month = matchDate.getMonth() + 1; // JavaScript months are 0-indexed
  
  // Premier League season runs from August to May
  // If month is August or later, it's the start of a new season
  const season = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

  return {
    external_id: match.id.toString(),
    home_team: match.homeTeam.name,
    away_team: match.awayTeam.name,
    home_score: match.score.fullTime.home,
    away_score: match.score.fullTime.away,
    status: match.status === 'POSTPONED' || match.status === 'SUSPENDED' || match.status === 'CANCELLED' 
      ? 'TIMED' 
      : match.status,
    kickoff_time: match.utcDate,
    gameweek: match.matchday,
    season,
  };
}

/**
 * Test API connection by fetching Premier League competition info
 */
export async function testApiConnection(): Promise<ApiResponse<Competition>> {
  return makeApiRequest<Competition>(`/competitions/${PREMIER_LEAGUE_ID}`);
}

/**
 * Get Premier League matches with proper parsing
 */
export async function getPremierLeagueMatches(
  dateFrom?: string,
  dateTo?: string
): Promise<ApiResponse<ParsedMatch[]>> {
  let endpoint = `/competitions/${PREMIER_LEAGUE_ID}/matches`;
  
  const params = new URLSearchParams();
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  
  if (params.toString()) {
    endpoint += `?${params.toString()}`;
  }

  const response = await makeApiRequest<MatchesResponse>(endpoint);
  
  if (response.error || !response.data) {
    return {
      data: null,
      error: response.error,
      status: response.status,
    };
  }

  try {
    const parsedMatches = response.data.matches.map(parseMatchData);
    return {
      data: parsedMatches,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: `Failed to parse match data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: response.status,
    };
  }
}

/**
 * Fetch Premier League matches (alias for getPremierLeagueMatches)
 * Used by caching layer
 */
export async function fetchPremierLeagueMatches(
  dateFrom?: string,
  dateTo?: string
): Promise<ParsedMatch[]> {
  const response = await getPremierLeagueMatches(dateFrom, dateTo);
  
  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to fetch matches');
  }
  
  return response.data;
}

/**
 * Get current Premier League standings
 */
export async function getPremierLeagueStandings(): Promise<ApiResponse<any>> {
  return makeApiRequest(`/competitions/${PREMIER_LEAGUE_ID}/standings`);
}

/**
 * Get rate limiting status for monitoring
 */
export function getRateLimitStatus() {
  const now = Date.now();
  const timeUntilReset = Math.max(0, RATE_LIMIT_WINDOW - (now - windowStart));
  
  return {
    requestCount,
    maxRequests: RATE_LIMIT_REQUESTS,
    windowStart,
    timeUntilReset,
    canMakeRequest: checkRateLimit(),
  };
}

/**
 * Get Premier League matches with caching (recommended for production use)
 * This function is re-exported from match-cache.ts to provide caching functionality
 */
export { getCachedMatches } from './match-cache';

// Export types for use in other modules
export type { ParsedMatch, FootballDataMatch, MatchesResponse, Competition, ApiResponse };