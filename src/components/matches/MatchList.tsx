"use client";

import { Match, Prediction } from "@/types/database";
import MatchGroup from "./MatchGroup";

interface MatchListProps {
  matches: Match[];
  predictions?: Prediction[];
  showPredictions?: boolean;
  showPoints?: boolean;
  groupBy?: 'date' | 'gameweek';
  className?: string;
}

export default function MatchList({ 
  matches, 
  predictions = [], 
  showPredictions = false, 
  showPoints = false,
  groupBy = 'date',
  className = "" 
}: MatchListProps) {
  const groupMatches = () => {
    if (groupBy === 'gameweek') {
      return groupByGameweek();
    }
    return groupByDate();
  };

  const groupByDate = () => {
    const grouped = matches.reduce((acc, match) => {
      const date = new Date(match.kickoff_time).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(match);
      return acc;
    }, {} as Record<string, Match[]>);

    // Sort dates
    return Object.entries(grouped).sort(([a], [b]) => 
      new Date(a).getTime() - new Date(b).getTime()
    );
  };

  const groupByGameweek = () => {
    const grouped = matches.reduce((acc, match) => {
      const gameweek = match.gameweek || 0;
      const key = `Gameweek ${gameweek}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(match);
      return acc;
    }, {} as Record<string, Match[]>);

    // Sort by gameweek number
    return Object.entries(grouped).sort(([a], [b]) => {
      const gameweekA = parseInt(a.split(' ')[1]) || 0;
      const gameweekB = parseInt(b.split(' ')[1]) || 0;
      return gameweekA - gameweekB;
    });
  };

  const formatGameweekDate = (gameweekLabel: string) => {
    // For gameweek grouping, we'll use the gameweek label as the date
    return gameweekLabel;
  };

  const groupedMatches = groupMatches();

  if (matches.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 text-6xl mb-4">⚽</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No matches found</h3>
        <p className="text-gray-500">Check back later for upcoming fixtures</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {groupedMatches.map(([groupKey, groupMatches]) => (
        <MatchGroup
          key={groupKey}
          date={groupBy === 'gameweek' ? formatGameweekDate(groupKey) : groupKey}
          matches={groupMatches}
          predictions={predictions}
          showPredictions={showPredictions}
          showPoints={showPoints}
        />
      ))}
    </div>
  );
}