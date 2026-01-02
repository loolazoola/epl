"use client";

import { Match, Prediction } from "@/types/database";
import MatchCard from "./MatchCard";

interface MatchGroupProps {
  date: string;
  matches: Match[];
  predictions?: Prediction[];
  showPredictions?: boolean;
  showPoints?: boolean;
  className?: string;
}

export default function MatchGroup({ 
  date, 
  matches, 
  predictions = [], 
  showPredictions = false, 
  showPoints = false,
  className = "" 
}: MatchGroupProps) {
  const formatGroupDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // Check if it's today, tomorrow, or yesterday
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    // Otherwise, format normally
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getPredictionForMatch = (matchId: string) => {
    return predictions.find(p => p.match_id === matchId);
  };

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border overflow-hidden ${className}`}>
      {/* Group Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {formatGroupDate(date)}
          </h2>
          <span className="text-sm text-gray-500">
            {matches.length} match{matches.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </div>

      {/* Matches */}
      <div className="divide-y divide-gray-100">
        {matches.map((match) => {
          const prediction = getPredictionForMatch(match.id);
          return (
            <div key={match.id} className="p-4">
              <MatchCard
                match={match}
                prediction={prediction}
                showPrediction={showPredictions}
                showPoints={showPoints}
                className="border-0 shadow-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}