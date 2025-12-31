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
  };
}

interface MatchesResponse {
  matches: Match[];
  count: number;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await fetch(`/api/football/matches?dateFrom=${today}&dateTo=${nextMonth}`);
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        setMatches(result.data?.matches || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
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

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'TIMED': 'bg-blue-100 text-blue-800',
      'SCHEDULED': 'bg-gray-100 text-gray-800',
      'LIVE': 'bg-red-100 text-red-800',
      'IN_PLAY': 'bg-red-100 text-red-800',
      'PAUSED': 'bg-yellow-100 text-yellow-800',
      'FINISHED': 'bg-green-100 text-green-800',
      'POSTPONED': 'bg-orange-100 text-orange-800',
      'CANCELLED': 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading matches...</p>
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
            onClick={fetchMatches}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Premier League Fixtures</h1>
          <p className="text-gray-600 mb-4">Upcoming matches for the next 30 days</p>
          <Navigation />
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No upcoming matches found</p>
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
                            <span className="font-medium text-gray-900 truncate">
                              {match.homeTeam.shortName}
                            </span>
                          </div>

                          {/* Score or Time */}
                          <div className="text-center min-w-[100px]">
                            {match.status === 'FINISHED' && match.score.fullTime.home !== null ? (
                              <div className="text-xl font-bold text-gray-900">
                                {match.score.fullTime.home} - {match.score.fullTime.away}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">
                                {formatTime(match.utcDate)}
                              </div>
                            )}
                          </div>

                          {/* Away Team */}
                          <div className="flex items-center space-x-3 w-48 justify-end">
                            <span className="font-medium text-gray-900 truncate">
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

                        {/* Status and Matchday */}
                        <div className="flex items-center space-x-4 ml-6">
                          {getStatusBadge(match.status)}
                          <span className="text-sm text-gray-500">
                            MD {match.matchday}
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
            onClick={fetchMatches}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Refresh Matches
          </button>
        </div>
      </div>
    </div>
  );
}