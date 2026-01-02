"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Navigation from "@/components/Navigation";
import { MatchCardSkeleton } from "@/components/LoadingSkeleton";
import MatchCard from "@/components/matches/MatchCard";
import PredictionModal from "@/components/predictions/PredictionModal";
import { Match as DatabaseMatch, Prediction } from "@/types/database";

// Football API Match format (different from database format)
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

export default function MatchesPage() {
  const { data: session } = useSession();
  const [matches, setMatches] = useState<FootballApiMatch[]>([]);
  const [dbMatches, setDbMatches] = useState<DatabaseMatch[]>([]);
  const [matchPredictions, setMatchPredictions] = useState<Record<string, Prediction>>({});
  const [currentGameweek, setCurrentGameweek] = useState<number | null>(null);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(20); // Default to gameweek 20
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingMatches, setSyncingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<FootballApiMatch | null>(null);
  const [showPredictionModal, setShowPredictionModal] = useState(false);

  // Convert Football API match to database match format for PredictionModal
  const convertToDbMatch = (apiMatch: FootballApiMatch): DatabaseMatch => {
    return {
      id: apiMatch.id.toString(),
      external_id: apiMatch.id.toString(),
      home_team: apiMatch.homeTeam.shortName,
      away_team: apiMatch.awayTeam.shortName,
      home_score: apiMatch.score.fullTime.home ?? undefined,
      away_score: apiMatch.score.fullTime.away ?? undefined,
      status: apiMatch.status as 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED',
      kickoff_time: apiMatch.utcDate,
      gameweek: apiMatch.matchday,
      season: '2024-25',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    if (session && dbMatches.length > 0) {
      fetchPredictionsForMatches();
    }
  }, [session, dbMatches]);

  const fetchPredictionsForMatches = async () => {
    if (!session) return;
    
    try {
      const predictionPromises = dbMatches.map(async (match) => {
        const response = await fetch(`/api/predictions/match/${match.id}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          return { matchId: match.external_id, prediction: result.data };
        }
        return { matchId: match.external_id, prediction: null };
      });

      const predictionResults = await Promise.all(predictionPromises);
      const predictionMap: Record<string, Prediction> = {};
      
      predictionResults.forEach(({ matchId, prediction }) => {
        if (prediction) {
          predictionMap[matchId] = prediction;
        }
      });
      
      setMatchPredictions(predictionMap);
    } catch (err) {
      console.error('Failed to fetch predictions for matches:', err);
    }
  };

  const fetchMatches = async (isRefresh = false, gameweek?: number) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Use provided gameweek or selected gameweek
      const targetGameweek = gameweek || selectedGameweek;
      setCurrentGameweek(targetGameweek);
      
      const response = await fetch(`/api/football/matches?gameweek=${targetGameweek}`);
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        const apiMatches = result.data?.matches || [];
        setMatches(apiMatches);
        
        // Also fetch database matches to get the proper IDs for predictions
        await fetchDatabaseMatches(apiMatches);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleGameweekChange = (newGameweek: number) => {
    setSelectedGameweek(newGameweek);
    fetchMatches(false, newGameweek);
  };

  const fetchDatabaseMatches = async (apiMatches: FootballApiMatch[]) => {
    try {
      // Get the external IDs from API matches
      const externalIds = apiMatches.map(match => match.id.toString());
      
      // Fetch corresponding database matches first
      const response = await fetch('/api/matches/by-external-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ external_ids: externalIds }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const dbMatches = result.data;
          setDbMatches(dbMatches);
          
          // Only sync if we're missing matches (optional background sync)
          const missingMatches = externalIds.filter(id => 
            !dbMatches.some((match: DatabaseMatch) => match.external_id === id)
          );
          
          if (missingMatches.length > 0) {
            console.log(`Found ${missingMatches.length} missing matches, syncing in background...`);
            setSyncingMatches(true);
            // Sync in background without blocking the UI
            fetch('/api/cron/sync-matches', { method: 'POST' })
              .then(() => {
                console.log('Background sync completed');
                // Optionally refresh database matches after sync
                return fetch('/api/matches/by-external-ids', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ external_ids: externalIds }),
                });
              })
              .then(response => response?.json())
              .then(result => {
                if (result?.success && result?.data) {
                  setDbMatches(result.data);
                }
              })
              .catch(syncError => {
                console.warn('Background sync failed:', syncError);
              })
              .finally(() => {
                setSyncingMatches(false);
              });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch database matches:', err);
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

  const handlePredictClick = (match: DatabaseMatch) => {
    // Find the original Football API match to maintain compatibility with the modal
    const originalMatch = matches.find(m => m.id.toString() === match.external_id);
    if (originalMatch) {
      setSelectedMatch(originalMatch);
      setShowPredictionModal(true);
    }
  };

  const handlePredictionSubmit = async (matchId: string, homeScore: number, awayScore: number) => {
    try {
      console.log('handlePredictionSubmit called with:', { matchId, homeScore, awayScore });
      console.log('Available dbMatches:', dbMatches);
      
      // matchId here is the Football API match ID (number as string)
      // Find the database match ID for this Football API match ID
      const dbMatch = dbMatches.find(m => m.external_id === matchId);
      console.log('Found dbMatch:', dbMatch);
      
      if (!dbMatch) {
        console.error('Database match not found for external ID:', matchId);
        throw new Error('Match not found in database');
      }

      console.log('Submitting prediction with database match ID:', dbMatch.id);

      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_id: dbMatch.id, // Use database match ID (UUID)
          predicted_home_score: homeScore,
          predicted_away_score: awayScore,
        }),
      });

      const result = await response.json();
      console.log('API response:', { status: response.status, result });

      if (!response.ok) {
        console.error('Failed to submit prediction:', result.error);
        throw new Error(result.error || 'Failed to submit prediction');
      }

      if (result.success) {
        // Refresh predictions for this specific match
        await fetchPredictionsForMatches();
      } else {
        throw new Error(result.error || 'Failed to submit prediction');
      }
    } catch (err) {
      console.error('Failed to submit prediction:', err);
      throw err; // Re-throw to let the form handle the error
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="pl-gradient shadow-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
                <span className="text-pl-primary font-bold text-xl">📅</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                Premier League Fixtures
              </h1>
            </div>
            <Navigation />
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-pl-primary/10 border border-pl-primary/20 rounded-lg">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-pl-primary border-t-transparent"></div>
              <div className="text-pl-primary">
                <div className="font-medium">Loading Premier League fixtures...</div>
                <div className="text-sm opacity-80">Fetching upcoming matches and your predictions</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-4">
                <div className="h-6 bg-muted rounded w-32 animate-pulse"></div>
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, matchIndex) => (
                    <MatchCardSkeleton key={matchIndex} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="pl-gradient shadow-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
                <span className="text-pl-primary font-bold text-xl">📅</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                Premier League Fixtures
              </h1>
            </div>
            <Navigation />
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="pl-card text-center p-8">
            <div className="text-destructive text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-card-foreground mb-2">Error Loading Matches</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button 
              onClick={() => fetchMatches()}
              className="pl-button-primary px-6 py-3 rounded-lg font-medium"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="pl-gradient shadow-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
                <span className="text-pl-primary font-bold text-xl">📅</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                  Premier League Fixtures
                </h1>
                <div className="flex items-center gap-4">
                  <p className="text-pl-white/80 text-sm">
                    {currentGameweek ? `Gameweek ${currentGameweek} fixtures` : 'Current gameweek fixtures'}
                  </p>
                  
                  {/* Gameweek Navigation */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGameweekChange(Math.max(1, selectedGameweek - 1))}
                      disabled={selectedGameweek <= 1 || loading}
                      className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-pl-white px-2 py-1 rounded text-sm transition-colors"
                    >
                      ← Prev
                    </button>
                    
                    <select
                      value={selectedGameweek}
                      onChange={(e) => handleGameweekChange(parseInt(e.target.value))}
                      disabled={loading}
                      className="bg-white/10 text-pl-white border border-white/20 rounded px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {Array.from({ length: 38 }, (_, i) => i + 1).map(gw => (
                        <option key={gw} value={gw} className="bg-pl-primary text-white">
                          GW {gw}
                        </option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => handleGameweekChange(Math.min(38, selectedGameweek + 1))}
                      disabled={selectedGameweek >= 38 || loading}
                      className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-pl-white px-2 py-1 rounded text-sm transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => fetchMatches(true)}
              disabled={refreshing || syncingMatches}
              className="bg-white/10 hover:bg-white/20 text-pl-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {refreshing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-pl-white border-t-transparent"></div>
                  <span>Refreshing...</span>
                </>
              ) : syncingMatches ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-pl-white border-t-transparent"></div>
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Refresh</span>
                </>
              )}
            </button>
          </div>
          <Navigation />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Background sync notification */}
        {syncingMatches && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <div>
                <div className="text-sm font-medium text-blue-800">
                  Updating match data in the background
                </div>
                <div className="text-xs text-blue-600">
                  New matches are being synchronized. This won't affect your current view.
                </div>
              </div>
            </div>
          </div>
        )}

        {matches.length === 0 ? (
          <div className="pl-card text-center p-12">
            <div className="text-muted-foreground text-5xl mb-4">📅</div>
            <h2 className="text-xl font-semibold text-card-foreground mb-2">No Upcoming Matches</h2>
            <p className="text-muted-foreground">No matches found for the next 30 days</p>
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
              }, {} as Record<string, FootballApiMatch[]>)
            ).map(([date, dayMatches]) => (
              <div key={date} className="space-y-4">
                <h2 className="text-xl font-bold text-card-foreground flex items-center gap-2">
                  <span className="w-1 h-6 bg-pl-primary rounded-full"></span>
                  {date}
                </h2>
                <div className="grid gap-4">
                  {dayMatches.map((match) => {
                    const dbMatch = convertToDbMatch(match);
                    const prediction = matchPredictions[match.id.toString()];
                    
                    return (
                      <MatchCard
                        key={match.id}
                        match={dbMatch}
                        prediction={prediction}
                        showPrediction={true}
                        showPoints={true}
                        onPredictClick={handlePredictClick}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Prediction Modal */}
      {selectedMatch && (
        <PredictionModal
          match={convertToDbMatch(selectedMatch)}
          isOpen={showPredictionModal}
          onClose={() => {
            setShowPredictionModal(false);
            setSelectedMatch(null);
          }}
          onSubmit={(matchId, homeScore, awayScore) => 
            handlePredictionSubmit(selectedMatch.id.toString(), homeScore, awayScore)
          }
          existingPrediction={matchPredictions[selectedMatch.id.toString()]}
        />
      )}
    </div>
  );
}