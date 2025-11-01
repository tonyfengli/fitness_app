"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  XIcon, 
  SpinnerIcon
} from "@acme/ui-shared";
import { 
  Exercise, 
  RoundData,
  SelectedCategory,
  filterExercises,
  filterExercisesByCategory,
  MUSCLE_GROUPS,
  MOVEMENT_PATTERNS,
  EQUIPMENT_OPTIONS
} from "./exercisePickerUtils";

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

// Single source of truth for exercise state
interface ExerciseState {
  inputValue: string;
  selectedExercise: Exercise | null;
  mode: 'typing' | 'selected' | 'empty';
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
  // Single state object for exercise selection
  const [state, setState] = useState<ExerciseState>({
    inputValue: "",
    selectedExercise: null,
    mode: 'empty'
  });

  const [isBrowseMode, setIsBrowseMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setState({
        inputValue: "",
        selectedExercise: null,
        mode: 'empty'
      });
      setIsBrowseMode(false);
      setSelectedCategory(null);
    }
  }, [isOpen]);

  // Scroll to top of container
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };


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

  // Clear input
  const handleClear = () => {
    setState({
      inputValue: "",
      selectedExercise: null,
      mode: 'empty'
    });
    inputRef.current?.focus();
  };

  // Filter exercises based on input or selected category
  const filteredExercises = (() => {
    if (state.inputValue.trim()) {
      return filterExercises(
        availableExercises,
        state.inputValue,
        null,
        {
          excludeWarmupOnly: roundName !== 'Warm-up',
          templateTypes: ['circuit']
        }
      );
    } else if (selectedCategory?.value) {
      const basicFiltered = availableExercises.filter(exercise => {
        const templateMatch = exercise.templateType?.includes('circuit') ?? true;
        const warmupMatch = roundName !== 'Warm-up' || !exercise.functionTags?.includes('warmup_only');
        return templateMatch && warmupMatch;
      });
      return filterExercisesByCategory(basicFiltered, selectedCategory);
    }
    return [];
  })();

  const handleAddExercise = () => {
    if (state.mode === 'empty') return;

    const isCustomExercise = state.mode === 'typing';
    const exerciseId = state.selectedExercise?.id || null;
    const customName = isCustomExercise ? state.inputValue.trim() : undefined;

    if (!exerciseId && !customName) return;

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
            newExerciseId: exerciseId,
            customName: customName
          });
        } else {
          // Adding to existing station
          mutations.addToStation.mutate({
            sessionId: sessionId || "",
            clientId: userId || "",
            roundName: roundName,
            targetStationIndex: targetStation,
            newExerciseId: exerciseId,
            customName: customName
          });
        }
      } else {
        // Add to end of round (for circuit/amrap rounds)
        mutations.addToRound.mutate({
          sessionId: sessionId || "",
          clientId: userId || "",
          roundName: roundName,
          newExerciseId: exerciseId,
          customName: customName
        });
      }
    }
  };

  const isLoading = mutations.addToStation.isPending || mutations.addToRound.isPending;
  const canAdd = state.mode !== 'empty' && !isLoading;

  if (!isOpen) return null;

  return (
    <div className="flex flex-col bg-white dark:bg-gray-800 h-full">
      {/* Header with integrated actions */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
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
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Action buttons moved to header area */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all focus:outline-none focus:ring-0 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleAddExercise}
            disabled={!canAdd}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all focus:outline-none focus:ring-0 ${
              canAdd
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-sm' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Adding...
              </div>
            ) : (
              (() => {
                const isStationsRound = roundData?.roundType === 'stations_round';
                if (isStationsRound) {
                  const uniqueStations = new Set(roundData.exercises.map(ex => ex.orderIndex));
                  const isNewStation = targetStation >= uniqueStations.size;
                  return isNewStation ? 'Create Station' : 'Add to Station';
                } else {
                  return 'Add to Round';
                }
              })()
            )}
          </button>
        </div>
      </div>

      {/* Search section */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="space-y-4 h-full flex flex-col">
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
                className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-900 dark:border-gray-100 rounded-lg pl-12 pr-12 py-4 text-lg font-medium text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-800 transition-all duration-200"
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
                setIsBrowseMode(!isBrowseMode);
                // Clear any text input and category when switching modes
                if (!isBrowseMode) {
                  setState({
                    inputValue: "",
                    selectedExercise: null,
                    mode: 'empty'
                  });
                  setSelectedCategory(null);
                } else {
                  setSelectedCategory(null);
                }
                scrollToTop();
              }}
              className={`p-3 rounded-lg border-2 transition-all duration-200 shadow-sm ${
                isBrowseMode 
                  ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' 
                  : 'border-gray-900 dark:border-gray-100 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={isBrowseMode ? "Back to search" : "Browse by category"}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>

          {/* Exercise Results or Browse Categories - Fixed height for 3 items */}
          <div ref={scrollContainerRef} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 overflow-y-auto" style={{ height: '180px' }}>
            {isBrowseMode && !selectedCategory ? (
              /* Browse Categories */
              <div className="space-y-0 h-full">
                <button
                  onClick={() => {
                    setSelectedCategory({ type: 'movement', value: '' });
                    scrollToTop();
                  }}
                  className="w-full p-4 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors"
                  style={{ height: '60px' }}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Movement Pattern</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Push, Pull, Squat, Hinge, etc.</div>
                </button>
                <button
                  onClick={() => {
                    setSelectedCategory({ type: 'muscle', value: '' });
                    scrollToTop();
                  }}
                  className="w-full p-4 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors"
                  style={{ height: '60px' }}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Muscle Group</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Chest, Back, Legs, etc.</div>
                </button>
                <button
                  onClick={() => {
                    setSelectedCategory({ type: 'equipment', value: '' });
                    scrollToTop();
                  }}
                  className="w-full p-4 text-left hover:bg-white dark:hover:bg-gray-800 transition-colors"
                  style={{ height: '60px' }}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Equipment</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dumbbells, Barbell, Bodyweight, etc.</div>
                </button>
              </div>
            ) : isBrowseMode && selectedCategory?.type === 'movement' && !selectedCategory.value ? (
              /* Movement Pattern Options - Scrollable */
              <div className="space-y-0">
                {/* Back button */}
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    scrollToTop();
                  }}
                  className="w-full p-3 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-2"
                  style={{ height: '50px' }}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Back to categories</span>
                </button>
                {MOVEMENT_PATTERNS.map((pattern) => (
                  <button
                    key={pattern.value}
                    onClick={() => {
                      setSelectedCategory({ type: 'movement', value: pattern.value });
                      scrollToTop();
                    }}
                    className="w-full p-4 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors flex-shrink-0"
                    style={{ height: '60px' }}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{pattern.label}</div>
                  </button>
                ))}
              </div>
            ) : isBrowseMode && selectedCategory?.type === 'muscle' && !selectedCategory.value ? (
              /* Muscle Group Options - Scrollable */
              <div className="space-y-0">
                {/* Back button */}
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    scrollToTop();
                  }}
                  className="w-full p-3 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-2"
                  style={{ height: '50px' }}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Back to categories</span>
                </button>
                {MUSCLE_GROUPS.map((muscle) => (
                  <button
                    key={muscle}
                    onClick={() => {
                      setSelectedCategory({ type: 'muscle', value: muscle });
                      scrollToTop();
                    }}
                    className="w-full p-4 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors flex-shrink-0"
                    style={{ height: '60px' }}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{muscle}</div>
                  </button>
                ))}
              </div>
            ) : isBrowseMode && selectedCategory?.type === 'equipment' && !selectedCategory.value ? (
              /* Equipment Options - Scrollable */
              <div className="space-y-0">
                {/* Back button */}
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    scrollToTop();
                  }}
                  className="w-full p-3 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-2"
                  style={{ height: '50px' }}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Back to categories</span>
                </button>
                {EQUIPMENT_OPTIONS.map((equipment) => (
                  <button
                    key={equipment.value}
                    onClick={() => {
                      setSelectedCategory({ type: 'equipment', value: equipment.value });
                      scrollToTop();
                    }}
                    className="w-full p-4 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors flex-shrink-0"
                    style={{ height: '60px' }}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{equipment.label}</div>
                  </button>
                ))}
              </div>
            ) : (isBrowseMode && selectedCategory?.value) || (!isBrowseMode) ? (
              /* Exercise Results */
              filteredExercises.length > 0 ? (
                <div className="space-y-0">
                  {/* Back button when showing category results */}
                  {isBrowseMode && selectedCategory?.value && (
                    <button
                      onClick={() => {
                        setSelectedCategory({ ...selectedCategory, value: '' });
                        scrollToTop();
                      }}
                      className="w-full p-3 text-left hover:bg-white dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-2"
                      style={{ height: '50px' }}
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Back to {selectedCategory.type === 'movement' ? 'movement patterns' : selectedCategory.type === 'muscle' ? 'muscle groups' : 'equipment'}</span>
                    </button>
                  )}
                  {filteredExercises.map((ex: Exercise) => (
                  <button
                    key={ex.id}
                    onClick={() => handleExerciseSelect(ex)}
                    className={`w-full px-4 py-3 text-left transition-colors flex-shrink-0 border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                      state.selectedExercise?.id === ex.id 
                        ? 'bg-gray-100 dark:bg-gray-800' 
                        : 'hover:bg-white dark:hover:bg-gray-800'
                    }`}
                    style={{ height: '60px' }}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {ex.name || ex.exerciseName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {ex.primaryMuscle?.toLowerCase().replace(/_/g, ' ')}
                    </div>
                  </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
                  {selectedCategory ? 'No exercises found in this category' : (state.inputValue.trim() ? 'No exercises found' : 'Start typing to search exercises')}
                </div>
              )
            ) : null}
          </div>

          {/* Status Indicator */}
          {state.mode !== 'empty' && (
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              {state.mode === 'selected' && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {state.selectedExercise?.name || state.selectedExercise?.exerciseName}
                  </span>
                </div>
              )}
              {state.mode === 'typing' && state.inputValue.trim() && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-gray-700 dark:text-gray-300">
                    Create new: <span className="font-medium">"{state.inputValue}"</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}