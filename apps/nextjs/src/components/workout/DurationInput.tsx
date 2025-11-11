"use client";

import React, { useState, useEffect } from "react";
import { Button, cn } from "@acme/ui-shared";

interface DurationInputProps {
  value: number; // Duration in seconds
  onChange: (seconds: number) => void;
  label?: string;
  presets?: { label: string; value: number; description?: string }[];
  allowCustom?: boolean;
  className?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}

export function DurationInput({ 
  value, 
  onChange, 
  label,
  presets,
  allowCustom = true,
  className,
  disabled = false,
  min,
  max
}: DurationInputProps) {
  const [isCustomMode, setIsCustomMode] = useState(!presets || presets.length === 0);
  const [customMinutes, setCustomMinutes] = useState(() => {
    const mins = Math.floor(value / 60);
    return mins > 0 ? mins : '';
  });
  const [customSeconds, setCustomSeconds] = useState(() => {
    const secs = value % 60;
    return secs > 0 ? secs : '';
  });

  // Sync internal state when value prop changes externally
  useEffect(() => {
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    setCustomMinutes(mins > 0 ? mins : '');
    setCustomSeconds(secs > 0 ? secs : '');
  }, [value]);

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins}m`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle preset selection
  const handlePresetSelect = (presetValue: number) => {
    onChange(presetValue);
    setIsCustomMode(false);
    setCustomMinutes(Math.floor(presetValue / 60));
    setCustomSeconds(presetValue % 60);
  };

  // Handle custom time changes
  const handleCustomChange = (minutes: number | string, seconds: number | string) => {
    const numMinutes = typeof minutes === 'string' ? (parseInt(minutes) || 0) : minutes;
    const numSeconds = typeof seconds === 'string' ? (parseInt(seconds) || 0) : seconds;
    
    const maxMinutes = max ? Math.floor(max / 60) : 999;
    const clampedMinutes = Math.max(0, Math.min(maxMinutes, numMinutes));
    const clampedSeconds = Math.max(0, Math.min(59, numSeconds));
    
    setCustomMinutes(minutes === '' ? '' : clampedMinutes);
    setCustomSeconds(seconds === '' ? '' : clampedSeconds);
    
    const totalSeconds = clampedMinutes * 60 + clampedSeconds;
    let constrainedSeconds = totalSeconds;
    
    if (min !== undefined) {
      constrainedSeconds = Math.max(min, constrainedSeconds);
    }
    if (max !== undefined) {
      constrainedSeconds = Math.min(max, constrainedSeconds);
    }
    
    onChange(constrainedSeconds);
  };

  // Check if current value matches any preset
  const matchingPreset = presets?.find(p => p.value === value);
  const isPresetValue = !!matchingPreset && !isCustomMode;

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
        </div>
      )}
      
      {/* Preset Options */}
      {presets && presets.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {presets.map((preset) => {
            const isSelected = value === preset.value && !isCustomMode;
            const isDisabled = preset.value < min || preset.value > max;
            return (
              <Button
                key={preset.value}
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "relative h-12 text-sm transition-all duration-200",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  isSelected && "ring-2 ring-offset-1 ring-blue-500 shadow-lg bg-blue-600 text-white",
                  !isSelected && !isDisabled && "hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                  isDisabled && "opacity-40 cursor-not-allowed",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => !isDisabled && handlePresetSelect(preset.value)}
                disabled={disabled || isDisabled}
                size="sm"
                title={preset.description}
              >
                <div className="flex flex-col items-center">
                  <span className={cn(
                    "font-semibold transition-all duration-200",
                    isSelected && "scale-105"
                  )}>
                    {preset.label}
                  </span>
                  {preset.description && (
                    <span className="text-xs opacity-75 mt-0.5 leading-3">
                      {preset.description.split(' - ')[0]}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                )}
              </Button>
            );
          })}
        </div>
      )}

      {/* Custom Time Input */}
      {allowCustom && (
        <div className="space-y-3">
          {presets && presets.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Custom Time
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-sm"
                onClick={() => setIsCustomMode(!isCustomMode)}
                disabled={disabled}
              >
                {isCustomMode ? "Hide" : "Show"}
              </Button>
            </div>
          )}
          
          {isCustomMode && (
            <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customMinutes}
                  onChange={(e) => handleCustomChange(e.target.value, customSeconds)}
                  className={cn(
                    "w-16 text-center text-lg font-mono bg-white dark:bg-gray-700",
                    "border-2 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                    "transition-all duration-200"
                  )}
                  min="0"
                  max={max ? Math.floor(max / 60) : undefined}
                  disabled={disabled}
                  placeholder="0"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">min</span>
              </div>
              
              <div className="text-gray-400 font-bold text-xl">:</div>
              
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customSeconds}
                  onChange={(e) => handleCustomChange(customMinutes, e.target.value)}
                  className={cn(
                    "w-16 text-center text-lg font-mono bg-white dark:bg-gray-700",
                    "border-2 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                    "transition-all duration-200"
                  )}
                  min="0"
                  max="59"
                  disabled={disabled}
                  placeholder="0"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">sec</span>
              </div>
              
              {((customMinutes !== '' && customMinutes > 0) || (customSeconds !== '' && customSeconds > 0)) && (
                <div className="ml-auto bg-blue-100 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
                  <div className="text-sm text-blue-700 dark:text-blue-300 font-mono font-semibold">
                    = {formatDuration((parseInt(customMinutes.toString()) || 0) * 60 + (parseInt(customSeconds.toString()) || 0))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Constraint Indicator */}
      {(min !== undefined || max !== undefined) && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span>
            {min !== undefined && `Min: ${formatDuration(min)}`}
            {min !== undefined && max !== undefined && ', '}
            {max !== undefined && `Max: ${formatDuration(max)}`}
          </span>
        </div>
      )}
    </div>
  );
}