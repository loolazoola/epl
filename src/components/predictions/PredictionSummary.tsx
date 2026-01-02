"use client";

import { Prediction } from "@/types/database";

interface PredictionSummaryProps {
  predictions: Prediction[];
  className?: string;
}

export default function PredictionSummary({ predictions, className = "" }: PredictionSummaryProps) {
  const totalPredictions = predictions.length;
  const processedPredictions = predictions.filter(p => p.processed);
  const totalPoints = predictions.reduce((sum, p) => sum + p.points_earned, 0);
  const exactScores = predictions.filter(p => p.points_earned === 5).length;
  const correctOutcomes = predictions.filter(p => p.points_earned === 2).length;
  const wrongPredictions = predictions.filter(p => p.processed && p.points_earned === 0).length;

  const averagePoints = processedPredictions.length > 0 
    ? (totalPoints / processedPredictions.length).toFixed(1) 
    : '0.0';

  const accuracy = processedPredictions.length > 0 
    ? (((exactScores + correctOutcomes) / processedPredictions.length) * 100).toFixed(1)
    : '0.0';

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Your Prediction Summary
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Predictions */}
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{totalPredictions}</div>
            <div className="text-sm text-blue-800">Total Predictions</div>
          </div>

          {/* Total Points */}
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{totalPoints}</div>
            <div className="text-sm text-purple-800">Total Points</div>
          </div>

          {/* Average Points */}
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{averagePoints}</div>
            <div className="text-sm text-green-800">Avg Points</div>
          </div>

          {/* Accuracy */}
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{accuracy}%</div>
            <div className="text-sm text-orange-800">Accuracy</div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        {processedPredictions.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-green-600">{exactScores}</div>
              <div className="text-xs text-gray-600">Exact Scores</div>
              <div className="text-xs text-green-600">5 pts each</div>
            </div>
            
            <div>
              <div className="text-lg font-semibold text-blue-600">{correctOutcomes}</div>
              <div className="text-xs text-gray-600">Correct Outcomes</div>
              <div className="text-xs text-blue-600">2 pts each</div>
            </div>
            
            <div>
              <div className="text-lg font-semibold text-red-600">{wrongPredictions}</div>
              <div className="text-xs text-gray-600">Wrong Predictions</div>
              <div className="text-xs text-red-600">0 pts each</div>
            </div>
          </div>
        )}

        {/* Pending Predictions */}
        {totalPredictions > processedPredictions.length && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              <strong>{totalPredictions - processedPredictions.length}</strong> predictions 
              are waiting for match results
            </div>
          </div>
        )}

        {/* No Predictions */}
        {totalPredictions === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">🎯</div>
            <div className="text-gray-600">No predictions yet</div>
            <div className="text-sm text-gray-500 mt-1">
              Start making predictions to see your stats here
            </div>
          </div>
        )}
      </div>
    </div>
  );
}