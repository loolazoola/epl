"use client";

import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";

interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface TableEntry {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface StandingsResponse {
  standings: Array<{
    table: TableEntry[];
  }>;
}

export default function TablePage() {
  const [table, setTable] = useState<TableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStandings();
  }, []);

  const fetchStandings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/football/standings');
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        setTable(result.data?.standings?.[0]?.table || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch standings');
    } finally {
      setLoading(false);
    }
  };

  const getPositionColor = (position: number) => {
    if (position <= 4) return 'text-green-600'; // Champions League
    if (position === 5) return 'text-blue-600'; // Europa League
    if (position === 6) return 'text-purple-600'; // Conference League
    if (position >= 18) return 'text-red-600'; // Relegation
    return 'text-gray-600';
  };

  const getPositionBadge = (position: number) => {
    if (position <= 4) return 'bg-green-100 border-green-200';
    if (position === 5) return 'bg-blue-100 border-blue-200';
    if (position === 6) return 'bg-purple-100 border-purple-200';
    if (position >= 18) return 'bg-red-100 border-red-200';
    return 'bg-gray-100 border-gray-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="pl-gradient shadow-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
                <span className="text-pl-primary font-bold text-xl">📊</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                Premier League Table
              </h1>
            </div>
            <Navigation />
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pl-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading table...</p>
          </div>
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
                <span className="text-pl-primary font-bold text-xl">📊</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                Premier League Table
              </h1>
            </div>
            <Navigation />
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="pl-card text-center p-8">
            <div className="text-destructive text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-card-foreground mb-2">Error Loading Table</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button 
              onClick={fetchStandings}
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
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
              <span className="text-pl-primary font-bold text-xl">📊</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                Premier League Table
              </h1>
              <p className="text-pl-white/80 text-sm">Current standings for the 2025/26 season</p>
            </div>
          </div>
          <Navigation />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {table.length === 0 ? (
          <div className="pl-card text-center p-12">
            <div className="text-muted-foreground text-5xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-card-foreground mb-2">No Table Data</h2>
            <p className="text-muted-foreground">Table data is not available at the moment</p>
          </div>
        ) : (
          <div className="pl-card overflow-hidden">
            {/* Legend */}
            <div className="bg-muted/50 px-6 py-4 border-b border-border">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                  <span className="text-muted-foreground">Champions League (1-4)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                  <span className="text-muted-foreground">Europa League (5)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
                  <span className="text-muted-foreground">Conference League (6)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                  <span className="text-muted-foreground">Relegation (18-20)</span>
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="bg-muted/30 border-b border-border">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-muted-foreground">
                <div className="col-span-1 text-center">Pos</div>
                <div className="col-span-4">Team</div>
                <div className="col-span-1 text-center">P</div>
                <div className="col-span-1 text-center">W</div>
                <div className="col-span-1 text-center">D</div>
                <div className="col-span-1 text-center">L</div>
                <div className="col-span-1 text-center">GD</div>
                <div className="col-span-2 text-center">Pts</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {table.map((entry) => (
                <div 
                  key={entry.team.id} 
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Position */}
                  <div className="col-span-1 flex items-center justify-center">
                    <div className={`w-8 h-8 rounded border-2 flex items-center justify-center text-sm font-bold ${getPositionBadge(entry.position)}`}>
                      <span className={getPositionColor(entry.position)}>
                        {entry.position}
                      </span>
                    </div>
                  </div>

                  {/* Team */}
                  <div className="col-span-4 flex items-center space-x-3">
                    <div className="w-8 h-8 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <img 
                        src={entry.team.crest} 
                        alt={entry.team.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-team.svg';
                        }}
                      />
                    </div>
                    <div>
                      <div className="font-medium text-card-foreground">{entry.team.shortName}</div>
                      <div className="text-sm text-muted-foreground hidden sm:block">{entry.team.name}</div>
                    </div>
                  </div>

                  {/* Played */}
                  <div className="col-span-1 text-center text-card-foreground font-medium">
                    {entry.playedGames}
                  </div>

                  {/* Won */}
                  <div className="col-span-1 text-center text-green-600 font-medium">
                    {entry.won}
                  </div>

                  {/* Draw */}
                  <div className="col-span-1 text-center text-yellow-600 font-medium">
                    {entry.draw}
                  </div>

                  {/* Lost */}
                  <div className="col-span-1 text-center text-red-600 font-medium">
                    {entry.lost}
                  </div>

                  {/* Goal Difference */}
                  <div className={`col-span-1 text-center font-medium ${
                    entry.goalDifference > 0 ? 'text-green-600' : 
                    entry.goalDifference < 0 ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {entry.goalDifference > 0 ? '+' : ''}{entry.goalDifference}
                  </div>

                  {/* Points */}
                  <div className="col-span-2 text-center">
                    <span className="text-xl font-bold text-card-foreground">{entry.points}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <button 
            onClick={fetchStandings}
            className="pl-button-primary px-6 py-3 rounded-lg font-medium"
          >
            Refresh Table
          </button>
        </div>

        {/* Additional Stats */}
        {table.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="pl-card p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Top Scorer (Goals For)</h3>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src={table[0].team.crest} 
                    alt={table[0].team.name}
                    className="w-6 h-6 object-contain"
                  />
                </div>
                <div>
                  <div className="font-medium text-card-foreground">{table[0].team.shortName}</div>
                  <div className="text-2xl font-bold text-pl-secondary">{table[0].goalsFor} goals</div>
                </div>
              </div>
            </div>

            <div className="pl-card p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Best Defense (Goals Against)</h3>
              <div className="flex items-center space-x-3">
                {(() => {
                  const bestDefense = [...table].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];
                  return (
                    <>
                      <div className="w-8 h-8 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img 
                          src={bestDefense.team.crest} 
                          alt={bestDefense.team.name}
                          className="w-6 h-6 object-contain"
                        />
                      </div>
                      <div>
                        <div className="font-medium text-card-foreground">{bestDefense.team.shortName}</div>
                        <div className="text-2xl font-bold text-pl-primary">{bestDefense.goalsAgainst} goals</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="pl-card p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Most Games Played</h3>
              <div className="flex items-center space-x-3">
                {(() => {
                  const mostGames = [...table].sort((a, b) => b.playedGames - a.playedGames)[0];
                  return (
                    <>
                      <div className="w-8 h-8 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img 
                          src={mostGames.team.crest} 
                          alt={mostGames.team.name}
                          className="w-6 h-6 object-contain"
                        />
                      </div>
                      <div>
                        <div className="font-medium text-card-foreground">{mostGames.team.shortName}</div>
                        <div className="text-2xl font-bold text-pl-accent">{mostGames.playedGames} games</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}