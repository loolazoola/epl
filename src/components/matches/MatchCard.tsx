"use client";

import { Match, Prediction } from "@/types/database";
import { 
  getPredictionTimingInfo, 
  getPredictionButtonText, 
  getPredictionStatusIndicator 
} from "@/lib/prediction-utils";

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  showPrediction?: boolean;
  showPoints?: boolean;
  className?: string;
  isLoading?: boolean;
  onPredictClick?: (match: Match) => void;
}

export default function MatchCard({ 
  match, 
  prediction, 
  showPrediction = false, 
  showPoints = false,
  className = "",
  isLoading = false,
  onPredictClick
}: MatchCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'TIMED': { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Scheduled' },
      'IN_PLAY': { color: 'bg-red-100 text-red-800 border-red-200', label: 'Live' },
      'PAUSED': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Paused' },
      'FINISHED': { color: 'bg-pl-secondary/20 text-pl-primary border-pl-secondary/30', label: 'Finished' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { color: 'bg-muted text-muted-foreground border-border', label: status };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getScoreDisplay = () => {
    if (match.status === 'FINISHED' && match.home_score !== undefined && match.away_score !== undefined) {
      return (
        <div className="text-xl font-bold text-card-foreground">
          {match.home_score} - {match.away_score}
        </div>
      );
    }
    
    if (match.status === 'IN_PLAY') {
      return (
        <div className="text-lg font-semibold text-red-600 animate-pulse">
          {match.home_score || 0} - {match.away_score || 0}
        </div>
      );
    }

    return (
      <div className="text-sm text-muted-foreground font-medium">
        {formatTime(match.kickoff_time)}
      </div>
    );
  };

  const getPredictionDisplay = () => {
    if (!prediction || !showPrediction) return null;

    return (
      <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
        <div className="text-xs text-muted-foreground mb-1 text-center">Your prediction:</div>
        <div className="text-sm font-semibold text-pl-primary text-center">
          {prediction.predicted_home_score} - {prediction.predicted_away_score}
        </div>
        {showPoints && prediction.processed && (
          <div className="text-xs text-pl-secondary font-medium mt-1 text-center bg-pl-secondary/10 px-2 py-1 rounded">
            +{prediction.points_earned} points
          </div>
        )}
      </div>
    );
  };

  const canPredict = () => {
    const now = new Date();
    const kickoffTime = new Date(match.kickoff_time);
    return match.status === 'TIMED' && kickoffTime > now;
  };

  const getTeamInitials = (teamName: string) => {
    return teamName.split(' ').map(word => word[0]).join('').substring(0, 3).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className={`pl-card animate-pulse ${className}`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-muted rounded w-24"></div>
            <div className="h-6 bg-muted rounded w-16"></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-8 h-8 bg-muted rounded-full"></div>
              <div className="h-4 bg-muted rounded w-20"></div>
            </div>
            <div className="h-6 bg-muted rounded w-12"></div>
            <div className="flex items-center space-x-3 flex-1 justify-end">
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="w-8 h-8 bg-muted rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`pl-card pl-card-hover transition-all duration-200 ${className}`}>
      <div className="p-4">
        {/* Match Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {formatDate(match.kickoff_time)}
            {match.gameweek && ` • Gameweek ${match.gameweek}`}
          </div>
          {getStatusBadge(match.status)}
        </div>

        {/* Teams and Score */}
        <div className="flex items-center justify-between">
          {/* Home Team */}
          <div className="flex items-center space-x-3 flex-1">
            <div className="w-10 h-10 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold text-pl-primary">
                {getTeamInitials(match.home_team)}
              </span>
            </div>
            <span className="font-medium text-card-foreground truncate text-sm sm:text-base">
              {match.home_team}
            </span>
          </div>

          {/* Score or Time */}
          <div className="text-center min-w-[100px] mx-4">
            {getScoreDisplay()}
          </div>

          {/* Away Team */}
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <span className="font-medium text-card-foreground truncate text-sm sm:text-base">
              {match.away_team}
            </span>
            <div className="w-10 h-10 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold text-pl-primary">
                {getTeamInitials(match.away_team)}
              </span>
            </div>
          </div>
        </div>

        {/* Prediction Display */}
        {getPredictionDisplay()}

        {/* Enhanced Prediction Section */}
        {onPredictClick && (
          <div className="mt-3 border-t border-border pt-3">
            {(() => {
              const timingInfo = getPredictionTimingInfo(match);
              const statusIndicator = getPredictionStatusIndicator(timingInfo, !!prediction);
              const buttonText = getPredictionButtonText(timingInfo, !!prediction);
              
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium border ${statusIndicator.className}`}>
                      {statusIndicator.icon} {statusIndicator.text}
                    </span>
                    {timingInfo.timeUntilLockout && timingInfo.status === 'available' && (
                      <span className="text-xs text-muted-foreground">
                        Locks in {timingInfo.timeUntilLockout}
                      </span>
                    )}
                  </div>
                  
                  {(timingInfo.canPredict || timingInfo.canEdit) && (
                    <button
                      onClick={() => onPredictClick(match)}
                      className="pl-button-primary px-4 py-2 text-sm rounded-lg"
                    >
                      {buttonText}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Legacy Prediction Status (for backward compatibility) */}
        {!onPredictClick && (
          <>
            {canPredict() && !prediction && (
              <div className="mt-3 text-center">
                <span className="text-xs text-pl-secondary bg-pl-secondary/10 border border-pl-secondary/20 px-3 py-1 rounded-full font-medium">
                  ⚽ Prediction available
                </span>
              </div>
            )}

            {prediction && !prediction.processed && match.status === 'TIMED' && (
              <div className="mt-3 text-center">
                <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full font-medium">
                  ✅ Prediction submitted
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}