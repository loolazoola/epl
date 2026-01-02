"use client";

import { useSession } from "next-auth/react";

interface LeaderboardEntry {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
    total_points: number;
  };
  rank: number;
  points: number;
  correct_predictions: number;
  total_predictions: number;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserRank?: number;
  isLoading?: boolean;
  className?: string;
}

export default function LeaderboardTable({ 
  entries, 
  currentUserRank, 
  isLoading = false,
  className = "" 
}: LeaderboardTableProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank.toString();
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-600";
    if (rank === 2) return "text-gray-500";
    if (rank === 3) return "text-orange-600";
    return "text-gray-700";
  };

  const getAccuracy = (correct: number, total: number) => {
    if (total === 0) return "0%";
    return `${((correct / total) * 100).toFixed(1)}%`;
  };

  const isCurrentUser = (userId: string) => {
    return currentUserId === userId;
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
        <div className="p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">🏆</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Rankings Yet</h3>
          <p className="text-gray-500">
            Start making predictions to appear on the leaderboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Leaderboard</h2>
        <p className="text-purple-100 text-sm">
          {entries.length} player{entries.length !== 1 ? 's' : ''} competing
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Points
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Predictions
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Accuracy
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((entry) => {
              const isCurrentUserRow = isCurrentUser(entry.user.id);
              return (
                <tr 
                  key={entry.user.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    isCurrentUserRow ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                  }`}
                >
                  {/* Rank */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-lg font-bold ${getRankColor(entry.rank)}`}>
                      {getRankDisplay(entry.rank)}
                    </div>
                  </td>

                  {/* Player */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {entry.user.avatar_url ? (
                        <img
                          src={entry.user.avatar_url}
                          alt={entry.user.name}
                          className="w-8 h-8 rounded-full border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-purple-600">
                            {entry.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className={`font-medium ${
                          isCurrentUserRow ? 'text-purple-900' : 'text-gray-900'
                        }`}>
                          {entry.user.name}
                          {isCurrentUserRow && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Points */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {entry.points}
                    </div>
                  </td>

                  {/* Predictions */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-900">
                      {entry.correct_predictions}/{entry.total_predictions}
                    </div>
                  </td>

                  {/* Accuracy */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-medium text-gray-900">
                      {getAccuracy(entry.correct_predictions, entry.total_predictions)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Current User Position (if not in top entries) */}
      {currentUserRank && currentUserRank > entries.length && (
        <div className="border-t bg-purple-50 px-6 py-4">
          <div className="text-center text-sm text-purple-700">
            Your current position: <strong>#{currentUserRank}</strong>
          </div>
        </div>
      )}
    </div>
  );
}