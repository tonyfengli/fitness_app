"use client";

import React, { useState, useEffect } from "react";
import { ExercisePicker } from "./ExercisePicker";
import { Exercise, RoundData } from "./exercisePickerUtils";

// Types
interface AddExerciseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add-to-station' | 'add-to-round' | 'create-station';
  roundData: RoundData;
  roundName: string;
  targetStation?: number;
  availableExercises: any[];
  mutations: {
    addToStation: any;
    addToRound: any;
  };
  sessionId: string;
  userId: string;
}

export function AddExerciseDrawer({
  isOpen,
  onClose,
  mode,
  roundData,
  roundName,
  targetStation = 0,
  availableExercises,
  mutations,
  sessionId,
  userId,
}: AddExerciseDrawerProps) {
  // Internal state for selected exercise
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [customExerciseName, setCustomExerciseName] = useState<string>("");

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedExerciseId(null);
      setCustomExerciseName("");
    }
  }, [isOpen]);


  const handleExerciseSelect = (exerciseId: string | null, customName?: string) => {
    setSelectedExerciseId(exerciseId);
    setCustomExerciseName(customName || "");
  };

  const handleAddExercise = () => {
    // Determine if we're adding to a station or to a round
    const isStationsRound = roundData?.roundType === 'stations_round';
    
    // Call the appropriate mutation based on round type
    if (sessionId && roundName) {
      if (isStationsRound) {
        // Check if we're creating a new station or adding to existing
        const uniqueStations = new Set(roundData.exercises.map(ex => ex.orderIndex));
        const isNewStation = targetStation >= uniqueStations.size;
        
        if (isNewStation) {
          // Creating a new station - use addToRound which will create a new orderIndex
          mutations.addToRound.mutate({
            sessionId: sessionId || "",
            clientId: userId || "",
            roundName: roundName,
            newExerciseId: selectedExerciseId,
            customName: selectedExerciseId ? undefined : customExerciseName
          });
        } else {
          // Adding to existing station
          mutations.addToStation.mutate({
            sessionId: sessionId || "",
            clientId: userId || "",
            roundName: roundName,
            targetStationIndex: targetStation,
            newExerciseId: selectedExerciseId,
            customName: selectedExerciseId ? undefined : customExerciseName
          });
        }
      } else {
        // Add to end of round (for circuit/amrap rounds)
        mutations.addToRound.mutate({
          sessionId: sessionId || "",
          clientId: userId || "",
          roundName: roundName,
          newExerciseId: selectedExerciseId,
          customName: selectedExerciseId ? undefined : customExerciseName
        });
      }
    }
  };

  const isLoading = mutations.addToStation.isPending || mutations.addToRound.isPending;

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {mode === 'add-to-station' 
                ? `Add Exercise to Station ${targetStation + 1}`
                : mode === 'create-station'
                ? `Create Station ${targetStation + 1}`
                : `Add Exercise to ${roundName}`
              }
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Choose an exercise to add
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6 flex flex-col">
        {!selectedExerciseId && !customExerciseName ? (
          <ExercisePicker
            availableExercises={availableExercises}
            onExerciseSelect={handleExerciseSelect}
            placeholder="Type exercise name..."
            filterOptions={{
              excludeWarmupOnly: roundName !== 'Warm-up',
              templateTypes: ['circuit']
            }}
          />
        ) : (
          // Exercise confirmation view
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded">
                  <svg className="w-4 h-4 text-green-700 dark:text-green-400" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedExerciseId 
                    ? availableExercises.find(ex => ex.id === selectedExerciseId)?.name || "Exercise Selected"
                    : customExerciseName || "Custom Exercise"
                  }
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(() => {
                  const isStationsRound = roundData?.roundType === 'stations_round';
                  const isCustom = !selectedExerciseId && customExerciseName;
                  
                  if (isCustom) {
                    return isStationsRound 
                      ? `Ready to add custom exercise to Station ${targetStation + 1}`
                      : `Ready to add custom exercise to ${roundName}`;
                  } else {
                    return isStationsRound 
                      ? `Ready to add this exercise to Station ${targetStation + 1}`
                      : `Ready to add this exercise to ${roundName}`;
                  }
                })()}
              </p>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedExerciseId(null);
                  setCustomExerciseName("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleAddExercise}
                disabled={(!selectedExerciseId && !customExerciseName) || isLoading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {(() => {
                  const isStationsRound = roundData?.roundType === 'stations_round';
                  const isCustom = !selectedExerciseId && customExerciseName;
                  
                  if (isLoading) return 'Adding...';
                  
                  if (isStationsRound) {
                    const uniqueStations = new Set(roundData.exercises.map(ex => ex.orderIndex));
                    const isNewStation = targetStation >= uniqueStations.size;
                    
                    if (isNewStation) {
                      return isCustom 
                        ? `Create Station ${targetStation + 1} with Custom` 
                        : `Create Station ${targetStation + 1}`;
                    } else {
                      return isCustom 
                        ? `Add Custom to Station ${targetStation + 1}` 
                        : `Add to Station ${targetStation + 1}`;
                    }
                  } else {
                    return isCustom ? 'Add Custom to Round' : 'Add to Round';
                  }
                })()}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}