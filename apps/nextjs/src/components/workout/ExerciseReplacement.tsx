"use client";

import { useState, useRef } from "react";
import { 
  XIcon, 
  SpinnerIcon,
  replaceExercise
} from "@acme/ui-shared";
import { 
  Exercise, 
  RoundData,
  filterExercises
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
  onBack?: () => void;
}

// Single source of truth for replacement state
interface ReplacementState {
  inputValue: string;
  selectedExercise: Exercise | null;
  mode: 'typing' | 'selected' | 'empty';
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
  onBack,
}: ExerciseReplacementProps) {
  // Single state object - no dual state management
  const [state, setState] = useState<ReplacementState>({
    inputValue: "",
    selectedExercise: null,
    mode: 'empty'
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Handle input changes with iOS-safe debouncing
  const handleInputChange = (value: string) => {
    setState(prev => ({
      ...prev,
      inputValue: value,
      selectedExercise: null, // Clear selection when typing
      mode: value.trim() ? 'typing' : 'empty'
    }));

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Always show results - no need to hide/show
  };

  // Handle exercise selection from results
  const handleExerciseSelect = (selectedExercise: Exercise) => {
    const exerciseName = selectedExercise.name || selectedExercise.exerciseName;
    setState({
      inputValue: exerciseName,
      selectedExercise,
      mode: 'selected'
    });
  };

  // Filter exercises based on input - only show when there's text input
  const filteredExercises = state.inputValue.trim() 
    ? filterExercises(
        availableExercises,
        state.inputValue,
        null,
        {
          excludeWarmupOnly: round?.roundName !== 'Warm-up',
          templateTypes: ['circuit']
        }
      )
    : [];

  // Clear input
  const handleClear = () => {
    setState({
      inputValue: "",
      selectedExercise: null,
      mode: 'empty'
    });
    inputRef.current?.focus();
  };

  // Handle replacement
  const handleReplace = async () => {
    if (state.mode === 'empty') return;

    const isCustomExercise = state.mode === 'typing';
    const exerciseId = state.selectedExercise?.id || null;
    const customName = isCustomExercise ? state.inputValue.trim() : undefined;

    if (!exerciseId && !customName) return;

    try {
      await replaceExercise({
        exercise: exercise,
        newExerciseId: exerciseId,
        customName,
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
  };

  const handleCancel = () => {
    setState({
      inputValue: "",
      selectedExercise: null,
      mode: 'empty'
    });
    onCancel();
  };

  const isReplacing = mutations.swapSpecific.isPending || mutations.swapCircuit.isPending;
  const canReplace = state.mode !== 'empty' && !isReplacing;

  return (
    <div className="flex flex-col bg-white dark:bg-gray-800 h-full">
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
      <div className="flex-1 p-6">
        <div className="space-y-4">
          {/* Search Input Row */}
          <div className="flex items-center gap-3">
            {/* Search Input Container */}
            <div className="relative w-4/5">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="Type exercise name..."
                value={state.inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-100 rounded-lg pl-12 pr-12 py-3 text-lg font-medium text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-900/20 dark:focus:ring-gray-100/20 focus:border-gray-900 dark:focus:border-gray-100 shadow-sm"
                autoComplete="off"
                spellCheck="false"
              />
              {/* Clear button */}
              {state.inputValue && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Browse Button - Standalone */}
            <button
              onClick={() => {
                // TODO: Toggle to browse mode
                console.log('Browse mode clicked');
              }}
              className="p-3 rounded-lg border-2 border-gray-900 dark:border-gray-100 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm"
              title="Browse by category"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>

          {/* Exercise Results - Always visible, max 3 items */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-y-auto" style={{ height: '180px' }}>
            {filteredExercises.length > 0 ? (
              filteredExercises.map((ex: Exercise) => (
                <button
                  key={ex.id}
                  onClick={() => handleExerciseSelect(ex)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 transition-colors flex-shrink-0"
                  style={{ height: '60px' }}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {ex.name || ex.exerciseName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {ex.primaryMuscle?.toLowerCase().replace(/_/g, ' ')}
                  </div>
                </button>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
                {state.inputValue.trim() ? 'No exercises found' : 'Start typing to search exercises'}
              </div>
            )}
          </div>

          {/* Status Indicator */}
          {state.mode !== 'empty' && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {state.mode === 'selected' && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Selected: {state.selectedExercise?.name || state.selectedExercise?.exerciseName}
                </div>
              )}
              {state.mode === 'typing' && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Custom exercise: "{state.inputValue}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-6">
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (onBack) {
                onBack();
              }
            }}
            className="flex-1 px-6 py-3 text-base font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-all focus:outline-none focus:ring-0 bg-transparent border border-gray-300 dark:border-gray-600"
          >
            Back
          </button>
          <button
            onClick={handleReplace}
            disabled={!canReplace}
            className={`flex-1 px-6 py-3 text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-0 ${
              canReplace
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-md' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {isReplacing ? (
              <div className="flex items-center justify-center gap-2">
                <SpinnerIcon className="h-4 w-4 animate-spin" />
                Replacing...
              </div>
            ) : (
              'Replace'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}