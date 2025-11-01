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
        <div className="space-y-4">
          {/* Exercise search */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <ExercisePicker
                availableExercises={availableExercises}
                onExerciseSelect={handleExerciseSelect}
                placeholder="Type exercise name..."
                filterOptions={{
                  excludeWarmupOnly: roundName !== 'Warm-up',
                  templateTypes: ['circuit']
                }}
                maxHeight="max-h-[400px]"
              />
            </div>
          </div>
          
          {/* Add button */}
          <div>
            <button
              onClick={handleAddExercise}
              disabled={(!selectedExerciseId && !customExerciseName) || isLoading}
              className={`h-12 px-10 text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-0 ${
                (selectedExerciseId || customExerciseName) && !isLoading
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Adding...</span>
                </div>
              ) : (
                (() => {
                  const isStationsRound = roundData?.roundType === 'stations_round';
                  const isCustom = !selectedExerciseId && customExerciseName;
                  
                  if (isStationsRound) {
                    const uniqueStations = new Set(roundData.exercises.map(ex => ex.orderIndex));
                    const isNewStation = targetStation >= uniqueStations.size;
                    
                    if (isNewStation) {
                      return isCustom 
                        ? `Create Station ${targetStation + 1}` 
                        : `Create Station ${targetStation + 1}`;
                    } else {
                      return isCustom 
                        ? `Add to Station ${targetStation + 1}` 
                        : `Add to Station ${targetStation + 1}`;
                    }
                  } else {
                    return isCustom ? 'Add to Round' : 'Add to Round';
                  }
                })()
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}