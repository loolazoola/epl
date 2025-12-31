"use client";

import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";

interface Match {
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
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };
}

interface MatchesResponse {
  matches: Match[];
  count: number;
}

export default function ResultsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
      const dateTo = today.toISOString().split('T')[0];
      
      const response = await fetch(`/api/football/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        // Filter only finished matches and sort by date (most recent first)
        const finishedMatches = (result.data?.matches || [])
          .filter((match: Match) => match.status === 'FINISHED')
          .sort((a: Match, b: Match) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());
        setMatches(finishedMatches);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getResultColor = (homeScore: number, awayScore: number, isHome: boolean) => {
    if (homeScore === awayScore) return 'text-yellow-600'; // Draw
    if ((homeScore > awayScore && isHome) || (awayScore > homeScore && !isHome)) {
      return 'text-green-600'; // Win
    }
    return 'text-red-600'; // Loss
  };

  const getScoreDisplay = (homeScore: number | null, awayScore: number | null) => {
    if (homeScore === null || awayScore === null) return 'N/A';
    return `${homeScore} - ${awayScore}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={fetchResults}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Premier League Results</h1>
          <p className="text-gray-600 mb-4">Recent match results from the last 30 days</p>
          <Navigation />
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No recent results found</p>
            <p className="text-gray-400 text-sm mt-2">Check back after some matches have been played</p>
          </div>
        ) : (
          <div className="space-y-6">
            {matches.reduce((acc, match) => {
              const matchDate = formatDate(match.utcDate);
              if (!acc[matchDate]) {
                acc[matchDate] = [];
              }
              acc[matchDate].push(match);
              return acc;
            }, {} as Record<string, Match[]>)
            && Object.entries(
              matches.reduce((acc, match) => {
                const matchDate = formatDate(match.utcDate);
                if (!acc[matchDate]) {
                  acc[matchDate] = [];
                }
                acc[matchDate].push(match);
                return acc;
              }, {} as Record<string, Match[]>)
            ).map(([date, dayMatches]) => (
              <div key={date} className="bg-white rounded-lg shadow-sm border">
                <div className="bg-gray-50 px-6 py-3 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">{date}</h2>
                </div>
                <div className="divide-y">
                  {dayMatches.map((match) => (
                    <div key={match.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6 flex-1">
                          {/* Home Team */}
                          <div className="flex items-center space-x-3 w-48">
                            <img 
                              src={match.homeTeam.crest} 
                              alt={match.homeTeam.name}
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-team.svg';
                              }}
                            />
                            <span className={`font-medium truncate ${
                              getResultColor(
                                match.score.fullTime.home || 0, 
                                match.score.fullTime.away || 0, 
                                true
                              )
                            }`}>
                              {match.homeTeam.shortName}
                            </span>
                          </div>

                          {/* Score */}
                          <div className="text-center min-w-[120px]">
                            <div className="text-2xl font-bold text-gray-900 mb-1">
                              {getScoreDisplay(match.score.fullTime.home, match.score.fullTime.away)}
                            </div>
                            {match.score.halfTime.home !== null && match.score.halfTime.away !== null && (
                              <div className="text-sm text-gray-500">
                                HT: {match.score.halfTime.home} - {match.score.halfTime.away}
                              </div>
                            )}
                          </div>

                          {/* Away Team */}
                          <div className="flex items-center space-x-3 w-48 justify-end">
                            <span className={`font-medium truncate ${
                              getResultColor(
                                match.score.fullTime.home || 0, 
                                match.score.fullTime.away || 0, 
                                false
                              )
                            }`}>
                              {match.awayTeam.shortName}
                            </span>
                            <img 
                              src={match.awayTeam.crest} 
                              alt={match.awayTeam.name}
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-team.svg';
                              }}
                            />
                          </div>
                        </div>

                        {/* Match Info */}
                        <div className="flex items-center space-x-4 ml-6">
                          <div className="text-right">
                            <div className="text-sm text-gray-500">
                              {formatTime(match.utcDate)}
                            </div>
                            <div className="text-sm text-gray-500">
                              MD {match.matchday}
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            FT
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button 
            onClick={fetchResults}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Refresh Results
          </button>
        </div>

        {/* Quick Stats */}
        {matches.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Matches</h3>
              <div className="text-3xl font-bold text-purple-600">{matches.length}</div>
              <p className="text-sm text-gray-500 mt-1">In the last 30 days</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Goals</h3>
              <div className="text-3xl font-bold text-green-600">
                {matches.reduce((total, match) => 
                  total + (match.score.fullTime.home || 0) + (match.score.fullTime.away || 0), 0
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Avg: {(matches.reduce((total, match) => 
                  total + (match.score.fullTime.home || 0) + (match.score.fullTime.away || 0), 0
                ) / Math.max(matches.length, 1)).toFixed(1)} per match
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Draws</h3>
              <div className="text-3xl font-bold text-yellow-600">
                {matches.filter(match => 
                  match.score.fullTime.home === match.score.fullTime.away
                ).length}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {((matches.filter(match => 
                  match.score.fullTime.home === match.score.fullTime.away
                ).length / Math.max(matches.length, 1)) * 100).toFixed(1)}% of matches
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}