import { NextResponse } from "next/server";

// Football-Data.org API service with rate limiting and error handling
const FOOTBALL_API_BASE_URL = process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4';
const PREMIER_LEAGUE_ID = 2021;

interface FootballApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  score: {
    fullTime: {
      home: number | null | undefined;
      away: number | null | undefined;
    };
  };
}

interface MatchesResponse {
  matches: FootballApiMatch[];
  count: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const gameweek = searchParams.get('gameweek') || undefined;
    
    const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
    
    if (!FOOTBALL_API_KEY) {
      return NextResponse.json({
        data: null,
        error: 'Football Data API key is not configured',
        status: 0,
      });
    }

    let endpoint = `/competitions/${PREMIER_LEAGUE_ID}/matches`;
    
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (gameweek) params.append('matchday', gameweek);
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const url = `${FOOTBALL_API_BASE_URL}${endpoint}`;
    console.log(`Making API request to: ${url}`);

    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': FOOTBALL_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log('API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      
      return NextResponse.json({
        data: null,
        error: `API Error: ${response.status} - ${errorText}`,
        status: response.status,
      });
    }

    const data: MatchesResponse = await response.json();
    console.log('API Response received successfully, matches count:', data.matches?.length || 0);

    // Add shortName field to teams if missing (some API responses don't include it)
    const processedMatches = data.matches.map(match => ({
      ...match,
      homeTeam: {
        ...match.homeTeam,
        shortName: match.homeTeam.shortName || match.homeTeam.name.replace(/\s+(FC|CF|United|City|Town|Rovers|Wanderers|Athletic|Albion)$/i, '').trim()
      },
      awayTeam: {
        ...match.awayTeam,
        shortName: match.awayTeam.shortName || match.awayTeam.name.replace(/\s+(FC|CF|United|City|Town|Rovers|Wanderers|Athletic|Albion)$/i, '').trim()
      }
    }));

    return NextResponse.json({
      data: {
        matches: processedMatches,
        count: data.count
      },
      error: null,
      status: response.status,
    });
  } catch (error) {
    console.error('Network error:', error);
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    });
  }
}