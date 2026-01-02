"use client";

interface MatchStatusProps {
  status: 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';
  kickoffTime?: string;
  className?: string;
}

export default function MatchStatus({ status, kickoffTime, className = "" }: MatchStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'TIMED':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          label: 'Scheduled',
          icon: '📅'
        };
      case 'IN_PLAY':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          label: 'Live',
          icon: '🔴'
        };
      case 'PAUSED':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          label: 'Half Time',
          icon: '⏸️'
        };
      case 'FINISHED':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          label: 'Full Time',
          icon: '✅'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          label: status,
          icon: '❓'
        };
    }
  };

  const config = getStatusConfig();

  const getTimeUntilKickoff = () => {
    if (!kickoffTime || status !== 'TIMED') return null;

    const now = new Date();
    const kickoff = new Date(kickoffTime);
    const diffMs = kickoff.getTime() - now.getTime();

    if (diffMs <= 0) return null;

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  const timeUntilKickoff = getTimeUntilKickoff();

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
      {timeUntilKickoff && (
        <span className="text-xs text-gray-500">
          in {timeUntilKickoff}
        </span>
      )}
    </div>
  );
}