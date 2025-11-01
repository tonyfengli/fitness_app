"use client";

import { useState } from "react";
import { 
  XIcon, 
  SpinnerIcon,
  replaceExercise
} from "@acme/ui-shared";
import { ExercisePicker } from "./ExercisePicker";
import { 
  Exercise, 
  RoundData,
  FilterOptions
} from "./exercisePickerUtils";

interface ExerciseReplacementProps {
  exercise: Exercise;
  round: RoundData;
  exerciseIndex: number;
  availableExercises: any[];
  sessionId: string;
  userId: string;
  circuitConfig: any;
  mutations: {
    swapSpecific: any;
    swapCircuit: any;
  };
  onCancel: () => void;
  onReplace: () => void;
}

export function ExerciseReplacement({
  exercise,
  round,
  exerciseIndex,
  availableExercises,
  sessionId,
  userId,
  circuitConfig,
  mutations,
  onCancel,
  onReplace,
}: ExerciseReplacementProps) {
  // State for selected exercise from ExercisePicker
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [customExerciseName, setCustomExerciseName] = useState<string>("");

  const handleExerciseSelect = (exerciseId: string | null, customName?: string) => {
    setSelectedExerciseId(exerciseId);
    setCustomExerciseName(customName || "");
  };

  const handleReplace = async () => {
    if ((selectedExerciseId || customExerciseName.trim()) && exercise && round) {
      try {
        await replaceExercise({
          exercise: exercise,
          newExerciseId: selectedExerciseId || null,
          customName: selectedExerciseId ? undefined : customExerciseName.trim(),
          round: round,
          sessionId: sessionId,
          userId: userId,
          circuitConfig,
          mutations: {
            swapSpecific: mutations.swapSpecific,
            swapCircuit: mutations.swapCircuit
          }
        });
        onReplace();
      } catch (error) {
        console.error('[ExerciseReplacement] Error:', error);
      }
    }
  };

  const handleCancel = () => {
    setSelectedExerciseId(null);
    setCustomExerciseName("");
    onCancel();
  };

  const isReplacing = mutations.swapSpecific.isPending || mutations.swapCircuit.isPending;


  return (
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Replace Exercise
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {exercise?.exerciseName}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-lg p-2 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-0"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="space-y-4">
          {/* Exercise search */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <ExercisePicker
                availableExercises={availableExercises}
                onExerciseSelect={handleExerciseSelect}
                placeholder="Type exercise name..."
                filterOptions={{
                  excludeWarmupOnly: round?.roundName !== 'Warm-up',
                  templateTypes: ['circuit']
                }}
                showIcon={false}
                maxHeight="max-h-[400px]"
                iconElement={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                }
              />
            </div>
          </div>
          
          {/* Replace button */}
          <div>
            <button
              onClick={handleReplace}
              disabled={(!selectedExerciseId && !customExerciseName.trim()) || isReplacing}
              className={`h-12 px-10 text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-0 ${
                (selectedExerciseId || customExerciseName.trim()) && !isReplacing
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-md' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              {isReplacing ? (
                <SpinnerIcon className="h-4 w-4 animate-spin" />
              ) : (
                'Replace'
              )}
            </button>
          </div>
        </div>
        
        {/* Footer with cancel button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCancel}
            className="px-8 py-4 text-lg font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-all focus:outline-none focus:ring-0 bg-transparent dark:bg-gray-700 border-gray-300 dark:border-gray-600 border hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}