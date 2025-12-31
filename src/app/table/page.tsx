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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading table...</p>
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
            onClick={fetchStandings}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Premier League Table</h1>
          <p className="text-gray-600 mb-4">Current standings for the 2025/26 season</p>
          <Navigation />
        </div>

        {table.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No table data available</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {/* Legend */}
            <div className="bg-gray-50 px-6 py-4 border-b">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                  <span className="text-gray-600">Champions League (1-4)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                  <span className="text-gray-600">Europa League (5)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
                  <span className="text-gray-600">Conference League (6)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                  <span className="text-gray-600">Relegation (18-20)</span>
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="bg-gray-50 border-b">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-gray-600">
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
            <div className="divide-y">
              {table.map((entry) => (
                <div 
                  key={entry.team.id} 
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
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
                    <img 
                      src={entry.team.crest} 
                      alt={entry.team.name}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-team.svg';
                      }}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{entry.team.shortName}</div>
                      <div className="text-sm text-gray-500 hidden sm:block">{entry.team.name}</div>
                    </div>
                  </div>

                  {/* Played */}
                  <div className="col-span-1 text-center text-gray-900 font-medium">
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
                    entry.goalDifference < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {entry.goalDifference > 0 ? '+' : ''}{entry.goalDifference}
                  </div>

                  {/* Points */}
                  <div className="col-span-2 text-center">
                    <span className="text-xl font-bold text-gray-900">{entry.points}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <button 
            onClick={fetchStandings}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Refresh Table
          </button>
        </div>

        {/* Additional Stats */}
        {table.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Top Scorer (Goals For)</h3>
              <div className="flex items-center space-x-3">
                <img 
                  src={table[0].team.crest} 
                  alt={table[0].team.name}
                  className="w-8 h-8 object-contain"
                />
                <div>
                  <div className="font-medium">{table[0].team.shortName}</div>
                  <div className="text-2xl font-bold text-green-600">{table[0].goalsFor} goals</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Best Defense (Goals Against)</h3>
              <div className="flex items-center space-x-3">
                {(() => {
                  const bestDefense = [...table].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];
                  return (
                    <>
                      <img 
                        src={bestDefense.team.crest} 
                        alt={bestDefense.team.name}
                        className="w-8 h-8 object-contain"
                      />
                      <div>
                        <div className="font-medium">{bestDefense.team.shortName}</div>
                        <div className="text-2xl font-bold text-blue-600">{bestDefense.goalsAgainst} goals</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Most Games Played</h3>
              <div className="flex items-center space-x-3">
                {(() => {
                  const mostGames = [...table].sort((a, b) => b.playedGames - a.playedGames)[0];
                  return (
                    <>
                      <img 
                        src={mostGames.team.crest} 
                        alt={mostGames.team.name}
                        className="w-8 h-8 object-contain"
                      />
                      <div>
                        <div className="font-medium">{mostGames.team.shortName}</div>
                        <div className="text-2xl font-bold text-purple-600">{mostGames.playedGames} games</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}