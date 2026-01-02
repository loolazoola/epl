"use client";

import { useState, useEffect } from "react";
import { Match, Prediction } from "@/types/database";
import { getPredictionTimingInfo } from "@/lib/prediction-utils";
import ScoreInput from "./ScoreInput";

interface PredictionFormProps {
  match: Match;
  existingPrediction?: Prediction;
  onSubmit: (homeScore: number, awayScore: number) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export default function PredictionForm({ 
  match, 
  existingPrediction, 
  onSubmit, 
  onCancel,
  className = "" 
}: PredictionFormProps) {
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form with existing prediction data
  useEffect(() => {
    if (existingPrediction && !isInitialized) {
      setHomeScore(existingPrediction.predicted_home_score);
      setAwayScore(existingPrediction.predicted_away_score);
      setIsInitialized(true);
    } else if (!existingPrediction && !isInitialized) {
      setHomeScore(0);
      setAwayScore(0);
      setIsInitialized(true);
    }
  }, [existingPrediction, isInitialized]);

  // Reset form when existingPrediction changes (e.g., switching between matches)
  useEffect(() => {
    if (existingPrediction) {
      setHomeScore(existingPrediction.predicted_home_score);
      setAwayScore(existingPrediction.predicted_away_score);
    } else {
      setHomeScore(0);
      setAwayScore(0);
    }
    setError(null);
    setSuccess(false);
  }, [existingPrediction?.id, match.id]); // Reset when prediction ID or match ID changes

  const canPredict = () => {
    const timingInfo = getPredictionTimingInfo(match);
    return timingInfo.canPredict || timingInfo.canEdit;
  };

  const getTimeUntilKickoff = () => {
    const timingInfo = getPredictionTimingInfo(match);
    return timingInfo.timeUntilKickoff;
  };

  const getTimingInfo = () => {
    return getPredictionTimingInfo(match);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const timingInfo = getTimingInfo();
    if (!timingInfo.canPredict && !timingInfo.canEdit) {
      setError(timingInfo.statusMessage);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await onSubmit(homeScore, awayScore);
      setSuccess(true);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit prediction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const timingInfo = getTimingInfo();
  const timeUntilKickoff = getTimeUntilKickoff();
  const isPredictionAllowed = canPredict();

  if (!isPredictionAllowed) {
    return (
      <div className={`pl-card text-center p-6 ${className}`}>
        <div className="text-muted-foreground text-5xl mb-4">
          {timingInfo.isLocked ? '🔒' : '⏰'}
        </div>
        <h3 className="text-lg font-semibold text-card-foreground mb-2">
          {timingInfo.statusMessage}
        </h3>
        <p className="text-muted-foreground mb-4">
          {timingInfo.isLocked 
            ? 'Predictions are locked within 2 hours of kickoff' 
            : 'Predictions are no longer allowed for this match'
          }
        </p>
        {existingPrediction && (
          <div className="p-4 bg-muted/50 rounded-lg border">
            <div className="text-sm text-muted-foreground mb-2">Your prediction:</div>
            <div className="text-xl font-bold text-pl-primary">
              {existingPrediction.predicted_home_score} - {existingPrediction.predicted_away_score}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`pl-card ${className}`}>
      <div className="p-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-card-foreground mb-2">
            {existingPrediction ? 'Update Your Prediction' : 'Make Your Prediction'}
          </h3>
          <div className="text-sm text-muted-foreground">
            {match.home_team} vs {match.away_team}
          </div>
          {timeUntilKickoff && (
            <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full mt-2 inline-block">
              ⏱️ Kickoff in {timeUntilKickoff}
            </div>
          )}
          {timingInfo.timeUntilLockout && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full mt-1 inline-block">
              🔒 Locks in {timingInfo.timeUntilLockout}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-center space-x-6 sm:space-x-8 mb-6">
            <ScoreInput
              label={match.home_team}
              value={homeScore}
              onChange={setHomeScore}
              disabled={isSubmitting}
            />
            
            <div className="text-3xl font-bold text-muted-foreground pt-6">
              -
            </div>
            
            <ScoreInput
              label={match.away_team}
              value={awayScore}
              onChange={setAwayScore}
              disabled={isSubmitting}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-destructive">❌</span>
                <div className="text-sm text-destructive font-medium">{error}</div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-pl-secondary/10 border border-pl-secondary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-pl-secondary">✅</span>
                <div className="text-sm text-pl-primary font-medium">
                  Prediction {existingPrediction ? 'updated' : 'submitted'} successfully!
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 pl-button-primary disabled:opacity-50 disabled:cursor-not-allowed py-3 px-6 text-center font-medium rounded-lg transition-all duration-200"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-pl-white border-t-transparent"></div>
                  <span>{existingPrediction ? 'Updating...' : 'Submitting...'}</span>
                </div>
              ) : (
                <span>{existingPrediction ? 'Update Prediction' : 'Submit Prediction'}</span>
              )}
            </button>
            
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-6 py-3 border border-border text-muted-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Scoring Info */}
        <div className="mt-6 p-4 bg-pl-primary/5 border border-pl-primary/10 rounded-lg">
          <h4 className="text-sm font-semibold text-pl-primary mb-3 flex items-center gap-2">
            <span>🏆</span>
            Scoring System
          </h4>
          <div className="text-xs text-pl-primary/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-pl-secondary rounded-full"></span>
              <span>Exact score: <strong className="text-pl-primary">5 points</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-pl-accent rounded-full"></span>
              <span>Correct outcome (win/draw): <strong className="text-pl-primary">2 points</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-muted-foreground rounded-full"></span>
              <span>Wrong prediction: <strong className="text-pl-primary">0 points</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}