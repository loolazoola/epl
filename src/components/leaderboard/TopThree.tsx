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

interface TopThreeProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  className?: string;
}

export default function TopThree({ entries, currentUserId, className = "" }: TopThreeProps) {
  const topThree = entries.slice(0, 3);
  
  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = [
    topThree.find(e => e.rank === 2),
    topThree.find(e => e.rank === 1),
    topThree.find(e => e.rank === 3),
  ].filter(Boolean) as LeaderboardEntry[];

  const getPodiumHeight = (rank: number) => {
    if (rank === 1) return "h-24";
    if (rank === 2) return "h-20";
    if (rank === 3) return "h-16";
    return "h-12";
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return "";
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-t from-yellow-400 to-yellow-300";
    if (rank === 2) return "bg-gradient-to-t from-gray-400 to-gray-300";
    if (rank === 3) return "bg-gradient-to-t from-orange-400 to-orange-300";
    return "bg-gray-200";
  };

  if (topThree.length === 0) {
    return (
      <div className={`bg-white rounded-lg border shadow-sm p-8 text-center ${className}`}>
        <div className="text-gray-400 text-6xl mb-4">🏆</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Champions Yet</h3>
        <p className="text-gray-500">Be the first to make predictions and claim the top spot!</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 text-center">
        <h2 className="text-xl font-bold text-white mb-1">🏆 Top Performers</h2>
        <p className="text-purple-100 text-sm">Leading the prediction game</p>
      </div>

      {/* Podium */}
      <div className="p-6">
        <div className="flex items-end justify-center space-x-4 mb-6">
          {podiumOrder.map((entry, index) => {
            const isCurrentUser = currentUserId === entry.user.id;
            return (
              <div key={entry.user.id} className="flex flex-col items-center">
                {/* User Avatar and Info */}
                <div className={`mb-2 text-center ${isCurrentUser ? 'ring-2 ring-purple-500 ring-opacity-50 rounded-lg p-2' : ''}`}>
                  {entry.user.avatar_url ? (
                    <img
                      src={entry.user.avatar_url}
                      alt={entry.user.name || 'User'}
                      className="w-16 h-16 rounded-full border-4 border-white shadow-lg mx-auto mb-2"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg mx-auto mb-2">
                      <span className="text-xl font-bold text-purple-600">
                        {entry.user.name && entry.user.name.length > 0 
                          ? entry.user.name.charAt(0).toUpperCase() 
                          : '?'
                        }
                      </span>
                    </div>
                  )}
                  
                  <div className="text-sm font-medium text-gray-900 truncate max-w-[80px]">
                    {entry.user.name || 'Unknown User'}
                  </div>
                  
                  {isCurrentUser && (
                    <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full mt-1">
                      You
                    </div>
                  )}
                  
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {entry.points} pts
                  </div>
                </div>

                {/* Podium Base */}
                <div className={`w-20 ${getPodiumHeight(entry.rank)} ${getRankColor(entry.rank)} rounded-t-lg flex items-center justify-center shadow-lg`}>
                  <div className="text-center">
                    <div className="text-2xl mb-1">{getRankEmoji(entry.rank)}</div>
                    <div className="text-white font-bold text-sm">#{entry.rank}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
          {topThree.map((entry) => (
            <div key={entry.user.id} className="text-center">
              <div className="text-xs text-gray-500 mb-1">
                {getRankEmoji(entry.rank)} {entry.user.name || 'Unknown User'}
              </div>
              <div className="text-sm font-medium text-gray-900">
                {entry.correct_predictions}/{entry.total_predictions} correct
              </div>
              <div className="text-xs text-gray-500">
                {entry.total_predictions > 0 
                  ? `${((entry.correct_predictions / entry.total_predictions) * 100).toFixed(1)}% accuracy`
                  : 'No predictions yet'
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}