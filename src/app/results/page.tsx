"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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

interface Prediction {
  id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  points_earned: number;
  processed: boolean;
}

interface MatchesResponse {
  matches: Match[];
  count: number;
}

export default function ResultsPage() {
  const { data: session } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
    if (session) {
      fetchPredictions();
    }
  }, [session]);

  const fetchPredictions = async () => {
    try {
      const response = await fetch('/api/predictions');
      const result = await response.json();
      
      if (result.success && result.data) {
        const predictionMap: Record<string, Prediction> = {};
        result.data.forEach((prediction: Prediction) => {
          predictionMap[prediction.match_id] = prediction;
        });
        setPredictions(predictionMap);
      }
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
    }
  };

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="pl-gradient shadow-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
              <span className="text-pl-primary font-bold text-xl">⚽</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                Premier League Results
              </h1>
              <p className="text-pl-white/80 text-sm">Recent match results from the last 30 days</p>
            </div>
          </div>
          <Navigation />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {matches.length === 0 ? (
          <div className="pl-card text-center p-12">
            <div className="text-muted-foreground text-5xl mb-4">⚽</div>
            <h2 className="text-xl font-semibold text-card-foreground mb-2">No Recent Results</h2>
            <p className="text-muted-foreground">Check back after some matches have been played</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(
              matches.reduce((acc, match) => {
                const matchDate = formatDate(match.utcDate);
                if (!acc[matchDate]) {
                  acc[matchDate] = [];
                }
                acc[matchDate].push(match);
                return acc;
              }, {} as Record<string, Match[]>)
            ).map(([date, dayMatches]) => (
              <div key={date} className="space-y-4">
                <h2 className="text-xl font-bold text-card-foreground flex items-center gap-2">
                  <span className="w-1 h-6 bg-pl-primary rounded-full"></span>
                  {date}
                </h2>
                <div className="space-y-4">
                  {dayMatches.map((match) => {
                    const prediction = predictions[match.id.toString()];
                    
                    return (
                      <div key={match.id} className="pl-card p-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6 flex-1">
                              {/* Home Team */}
                              <div className="flex items-center space-x-3 w-48">
                                <div className="w-10 h-10 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <img 
                                    src={match.homeTeam.crest} 
                                    alt={match.homeTeam.name}
                                    className="w-6 h-6 object-contain"
                                    onError={(e) => {
                                      e.currentTarget.src = '/placeholder-team.svg';
                                    }}
                                  />
                                </div>
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
                                <div className="text-2xl font-bold text-card-foreground mb-1">
                                  {getScoreDisplay(match.score.fullTime.home, match.score.fullTime.away)}
                                </div>
                                {match.score.halfTime.home !== null && match.score.halfTime.away !== null && (
                                  <div className="text-sm text-muted-foreground">
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
                                <div className="w-10 h-10 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <img 
                                    src={match.awayTeam.crest} 
                                    alt={match.awayTeam.name}
                                    className="w-6 h-6 object-contain"
                                    onError={(e) => {
                                      e.currentTarget.src = '/placeholder-team.svg';
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Match Info */}
                            <div className="flex items-center space-x-4 ml-6">
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">
                                  {formatTime(match.utcDate)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  MD {match.matchday}
                                </div>
                              </div>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-pl-secondary/20 text-pl-primary border border-pl-secondary/30">
                                FT
                              </span>
                            </div>
                          </div>

                          {/* Prediction Results */}
                          {session && prediction && (
                            <div className="border-t border-border pt-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="text-sm text-muted-foreground">Your prediction:</div>
                                  <div className="font-medium text-card-foreground">
                                    {prediction.predicted_home_score} - {prediction.predicted_away_score}
                                  </div>
                                </div>
                                {prediction.processed && (
                                  <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                                    prediction.points_earned === 5 ? 'bg-green-100 text-green-800 border border-green-200' :
                                    prediction.points_earned === 2 ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                    'bg-red-100 text-red-800 border border-red-200'
                                  }`}>
                                    {prediction.points_earned === 5 ? '🎯 Exact! +5 pts' :
                                     prediction.points_earned === 2 ? '✅ Outcome! +2 pts' :
                                     '❌ Wrong +0 pts'}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button 
            onClick={fetchResults}
            className="pl-button-primary px-6 py-3 rounded-lg font-medium"
          >
            Refresh Results
          </button>
        </div>

        {/* Quick Stats */}
        {matches.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="pl-card p-6 text-center">
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Total Matches</h3>
              <div className="text-3xl font-bold text-pl-primary">{matches.length}</div>
              <p className="text-sm text-muted-foreground mt-1">In the last 30 days</p>
            </div>

            <div className="pl-card p-6 text-center">
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Total Goals</h3>
              <div className="text-3xl font-bold text-pl-secondary">
                {matches.reduce((total, match) => 
                  total + (match.score.fullTime.home || 0) + (match.score.fullTime.away || 0), 0
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Avg: {(matches.reduce((total, match) => 
                  total + (match.score.fullTime.home || 0) + (match.score.fullTime.away || 0), 0
                ) / Math.max(matches.length, 1)).toFixed(1)} per match
              </p>
            </div>

            <div className="pl-card p-6 text-center">
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Your Points</h3>
              <div className="text-3xl font-bold text-pl-accent">
                {Object.values(predictions).reduce((total, pred) => total + pred.points_earned, 0)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                From {Object.values(predictions).filter(p => p.processed).length} predictions
              </p>
            </div>

            <div className="pl-card p-6 text-center">
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Draws</h3>
              <div className="text-3xl font-bold text-yellow-600">
                {matches.filter(match => 
                  match.score.fullTime.home === match.score.fullTime.away
                ).length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {((matches.filter(match => 
                  match.score.fullTime.home === match.score.fullTime.away
                ).length / Math.max(matches.length, 1)) * 100).toFixed(1)}% of matches
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}