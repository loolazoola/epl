"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Navigation from "@/components/Navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { LeaderboardProvider } from "@/components/LeaderboardProvider";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import TopThree from "@/components/leaderboard/TopThree";
import { useRealtimeSubscription } from "@/components/RealtimeProvider";

interface LeaderboardEntry {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
    total_points: number;
    created_at: string;
    updated_at: string;
  };
  rank: number;
  points: number;
  correct_predictions: number;
  total_predictions: number;
}

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Set up real-time subscription for user updates
  const handleRealtimeUpdate = useCallback((payload: any) => {
    console.log('Leaderboard real-time update:', payload);
    // Refresh leaderboard when users table changes
    fetchLeaderboard();
  }, []);

  useRealtimeSubscription('users', handleRealtimeUpdate);

  const fetchLeaderboard = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const response = await fetch('/api/leaderboard');
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        setLeaderboard(result.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const transformLeaderboardData = (data: any[]): any[] => {
    return data.map(entry => ({
      user: {
        id: entry.user.id,
        name: entry.user.name,
        email: entry.user.email,
        avatar_url: entry.user.avatar_url,
        total_points: entry.user.total_points,
      },
      rank: entry.rank,
      points: entry.points,
      correct_predictions: entry.correct_predictions,
      total_predictions: entry.total_predictions,
    }));
  };

  const transformedLeaderboard = transformLeaderboardData(leaderboard);
  const currentUserEntry = leaderboard.find(entry => entry.user.email === session?.user?.email);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="pl-gradient shadow-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
                <span className="text-pl-primary font-bold text-xl">🏆</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                Leaderboard
              </h1>
            </div>
            <Navigation />
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner message="Loading leaderboard..." />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <header className="pl-gradient shadow-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
                <span className="text-pl-primary font-bold text-xl">🏆</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                Leaderboard
              </h1>
            </div>
            <Navigation />
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="pl-card text-center p-8">
            <div className="text-destructive text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-card-foreground mb-2">Error Loading Leaderboard</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button 
              onClick={() => fetchLeaderboard()}
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
    <LeaderboardProvider>
      <div className="min-h-screen bg-background">
        <header className="pl-gradient shadow-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
                  <span className="text-pl-primary font-bold text-xl">🏆</span>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                    Leaderboard
                  </h1>
                  <p className="text-pl-white/80 text-sm">See how you rank against other players</p>
                </div>
              </div>
              
              <button 
                onClick={() => fetchLeaderboard(true)}
                disabled={refreshing}
                className="bg-white/10 hover:bg-white/20 text-pl-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {refreshing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-pl-white border-t-transparent"></div>
                    <span>Refreshing...</span>
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
          {leaderboard.length === 0 ? (
            <div className="pl-card text-center p-12">
              <div className="text-muted-foreground text-5xl mb-4">🏆</div>
              <h2 className="text-xl font-semibold text-card-foreground mb-2">No Players Yet</h2>
              <p className="text-muted-foreground">Be the first to make predictions and appear on the leaderboard!</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Current User Stats */}
              {currentUserEntry && (
                <div className="pl-card p-6 border-l-4 border-l-pl-primary">
                  <h2 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
                    <span className="text-2xl">👤</span>
                    Your Position
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-pl-primary">#{currentUserEntry.rank}</div>
                      <div className="text-sm text-muted-foreground">Rank</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-pl-secondary">{currentUserEntry.points}</div>
                      <div className="text-sm text-muted-foreground">Points</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-pl-accent">{currentUserEntry.correct_predictions}</div>
                      <div className="text-sm text-muted-foreground">Correct</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-muted-foreground">{currentUserEntry.total_predictions}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top 3 Podium */}
              {transformedLeaderboard.length >= 3 && (
                <TopThree 
                  entries={transformedLeaderboard.slice(0, 3)}
                  currentUserId={session?.user?.email || undefined}
                />
              )}

              {/* Full Leaderboard Table */}
              <LeaderboardTable 
                entries={transformedLeaderboard}
                currentUserRank={currentUserEntry?.rank}
              />

              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="pl-card p-6 text-center">
                  <div className="text-3xl font-bold text-pl-primary mb-2">
                    {leaderboard.length}
                  </div>
                  <div className="text-muted-foreground">Total Players</div>
                </div>
                
                <div className="pl-card p-6 text-center">
                  <div className="text-3xl font-bold text-pl-secondary mb-2">
                    {leaderboard.reduce((sum, entry) => sum + entry.total_predictions, 0)}
                  </div>
                  <div className="text-muted-foreground">Total Predictions</div>
                </div>
                
                <div className="pl-card p-6 text-center">
                  <div className="text-3xl font-bold text-pl-accent mb-2">
                    {leaderboard.length > 0 ? Math.round(
                      leaderboard.reduce((sum, entry) => sum + (entry.points || 0), 0) / leaderboard.length
                    ) : 0}
                  </div>
                  <div className="text-muted-foreground">Average Points</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </LeaderboardProvider>
  );
}