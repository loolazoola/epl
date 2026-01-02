"use client";

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

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
  className?: string;
}

export default function LeaderboardCard({ 
  entry, 
  isCurrentUser = false,
  className = "" 
}: LeaderboardCardProps) {
  const getRankDisplay = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-600 bg-yellow-50";
    if (rank === 2) return "text-gray-600 bg-gray-50";
    if (rank === 3) return "text-orange-600 bg-orange-50";
    return "text-gray-700 bg-gray-50";
  };

  const getAccuracy = () => {
    if (entry.total_predictions === 0) return "0%";
    return `${((entry.correct_predictions / entry.total_predictions) * 100).toFixed(1)}%`;
  };

  return (
    <div className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
      isCurrentUser ? 'ring-2 ring-purple-500 ring-opacity-50' : ''
    } ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          {/* Rank */}
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${getRankColor(entry.rank)}`}>
            {getRankDisplay(entry.rank)}
          </div>
          
          {/* Current User Badge */}
          {isCurrentUser && (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
              You
            </span>
          )}
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-3 mb-4">
          {entry.user.avatar_url ? (
            <img
              src={entry.user.avatar_url}
              alt={entry.user.name || 'User'}
              className="w-12 h-12 rounded-full border-2 border-gray-200"
            />
          ) : (
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-purple-600">
                {entry.user.name && entry.user.name.length > 0 
                  ? entry.user.name.charAt(0).toUpperCase() 
                  : '?'
                }
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {entry.user.name || 'Unknown User'}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {entry.user.email}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-purple-600">{entry.points}</div>
            <div className="text-xs text-gray-500">Points</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">
              {entry.correct_predictions}/{entry.total_predictions}
            </div>
            <div className="text-xs text-gray-500">Correct</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{getAccuracy()}</div>
            <div className="text-xs text-gray-500">Accuracy</div>
          </div>
        </div>
      </div>
    </div>
  );
}