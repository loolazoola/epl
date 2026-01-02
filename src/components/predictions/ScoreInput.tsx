"use client";

import { useState, useEffect } from "react";

interface ScoreInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  className?: string;
}

export default function ScoreInput({ 
  label, 
  value, 
  onChange, 
  disabled = false, 
  min = 0, 
  max = 20,
  className = "" 
}: ScoreInputProps) {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Allow empty string for better UX while typing
    if (newValue === '') {
      setInputValue('');
      return;
    }

    // Only allow numbers
    if (!/^\d+$/.test(newValue)) {
      return;
    }

    const numValue = parseInt(newValue, 10);
    
    // Validate range
    if (numValue < min || numValue > max) {
      return;
    }

    setInputValue(newValue);
    onChange(numValue);
  };

  const handleBlur = () => {
    // If empty on blur, reset to current value
    if (inputValue === '') {
      setInputValue(value.toString());
    }
  };

  const increment = () => {
    if (value < max && !disabled) {
      onChange(value + 1);
    }
  };

  const decrement = () => {
    if (value > min && !disabled) {
      onChange(value - 1);
    }
  };

  const getTeamInitials = (teamName: string) => {
    return teamName.split(' ').map(word => word[0]).join('').substring(0, 3).toUpperCase();
  };

  return (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      {/* Team Label */}
      <div className="text-center">
        <div className="w-12 h-12 bg-pl-primary/10 border border-pl-primary/20 rounded-lg flex items-center justify-center mb-2">
          <span className="text-sm font-bold text-pl-primary">
            {getTeamInitials(label)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-medium max-w-[100px] truncate">
          {label}
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        {/* Decrement Button */}
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || value <= min}
          className="w-8 h-8 rounded-lg bg-pl-primary hover:bg-pl-primary/90 disabled:bg-muted disabled:text-muted-foreground text-pl-white flex items-center justify-center transition-colors font-bold text-sm"
        >
          −
        </button>

        {/* Score Input */}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className="w-16 h-12 text-center text-xl font-bold border-2 border-border rounded-lg focus:border-pl-secondary focus:outline-none focus:ring-2 focus:ring-pl-secondary/20 disabled:bg-muted disabled:cursor-not-allowed bg-input text-foreground transition-all"
          placeholder="0"
        />

        {/* Increment Button */}
        <button
          type="button"
          onClick={increment}
          disabled={disabled || value >= max}
          className="w-8 h-8 rounded-lg bg-pl-primary hover:bg-pl-primary/90 disabled:bg-muted disabled:text-muted-foreground text-pl-white flex items-center justify-center transition-colors font-bold text-sm"
        >
          +
        </button>
      </div>

      {/* Validation Message */}
      <div className="text-xs text-muted-foreground">
        {min} - {max} goals
      </div>
    </div>
  );
}