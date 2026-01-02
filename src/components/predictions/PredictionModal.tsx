"use client";

import { useState, useEffect } from "react";
import { Match, Prediction } from "@/types/database";
import PredictionForm from "./PredictionForm";

interface PredictionModalProps {
  match: Match | null;
  existingPrediction?: Prediction;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
}

export default function PredictionModal({ 
  match, 
  existingPrediction, 
  isOpen, 
  onClose, 
  onSubmit 
}: PredictionModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Delay hiding to allow animation
      const timer = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = async (homeScore: number, awayScore: number) => {
    if (!match) return;
    try {
      await onSubmit(match.id, homeScore, awayScore);
      // Close modal on successful submission
      onClose();
    } catch (error) {
      // Error is handled by the form component, don't close modal
      console.error('Prediction submission failed:', error);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 transition-opacity duration-150 ${
        isOpen ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
    >
      <div 
        className={`w-full max-w-md transform transition-all duration-150 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {match && (
          <div className="relative">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ✕
            </button>

            <PredictionForm
              match={match}
              existingPrediction={existingPrediction}
              onSubmit={handleSubmit}
              onCancel={onClose}
            />
          </div>
        )}
      </div>
    </div>
  );
}