"use client";

import React, { useState, useEffect } from "react";
import { XIcon, ChevronRightIcon, ChevronLeftIcon } from "@acme/ui-shared";
import { 
  Exercise, 
  SelectedCategory, 
  FilterOptions,
  MUSCLE_GROUPS,
  MOVEMENT_PATTERNS,
  EQUIPMENT_OPTIONS,
  filterExercises
} from "./exercisePickerUtils";

// Types
interface ExercisePickerProps {
  // Core functionality
  availableExercises: Exercise[];
  onExerciseSelect: (exerciseId: string | null, customName?: string) => void;
  
  // Optional customization
  placeholder?: string;
  filterOptions?: FilterOptions;
  
  // UI customization
  showIcon?: boolean;
  iconElement?: React.ReactNode;
  inputClassName?: string;
  maxHeight?: string;
  
  // Initial state (for controlled usage)
  initialSearchQuery?: string;
  initialSelectedId?: string | null;
}

interface ExercisePickerState {
  searchQuery: string;
  selectedId: string | null;
  selectedCategory: SelectedCategory | null;
  categoryMode: 'choice' | 'muscle' | 'movement' | 'equipment';
}

export function ExercisePicker({
  availableExercises,
  onExerciseSelect,
  placeholder = "Type exercise name...",
  filterOptions = {},
  showIcon = true,
  iconElement,
  inputClassName,
  maxHeight,
  initialSearchQuery = "",
  initialSelectedId = null,
}: ExercisePickerProps) {
  // Internal state for UI
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const [categoryMode, setCategoryMode] = useState<'choice' | 'muscle' | 'movement' | 'equipment'>('choice');

  // Reset state when component unmounts or resets
  const resetState = () => {
    setSearchQuery("");
    setSelectedId(null);
    setSelectedCategory(null);
    setCategoryMode('choice');
  };

  // Handle search query changes
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    // Clear selection when typing
    if (selectedId) {
      setSelectedId(null);
    }
    // Automatically trigger custom exercise when typing
    if (query.trim()) {
      onExerciseSelect(null, query.trim());
    } else {
      onExerciseSelect(null);
    }
  };

  // Handle exercise selection
  const handleExerciseClick = (exercise: Exercise) => {
    const exerciseName = exercise.name || exercise.exerciseName;
    setSearchQuery(exerciseName);
    setSelectedId(exercise.id);
    onExerciseSelect(exercise.id, exerciseName);
  };


  // Clear search and selection
  const handleClear = () => {
    setSearchQuery("");
    setSelectedId(null);
    onExerciseSelect(null);
  };

  // Filter exercises based on current state
  const filteredExercises = filterExercises(
    availableExercises,
    searchQuery,
    selectedCategory,
    filterOptions
  );


  // Default icon if none provided
  const defaultIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  return (
    <div className="space-y-4">
      {/* Search input row */}
      <div>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
              {iconElement || defaultIcon}
            </div>
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={inputClassName || "w-full bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-100 rounded-lg pl-12 pr-12 py-3 text-lg font-medium text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-900/20 dark:focus:ring-gray-100/20 focus:border-gray-900 dark:focus:border-gray-100 shadow-sm"}
            />
            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <XIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Dynamic content area */}
      <div className={maxHeight ? `overflow-hidden ${maxHeight}` : "flex-1 overflow-hidden"}>
        {(() => {
          // If there's search text or a category selected, show filtered results
          if ((searchQuery || selectedCategory) && !selectedId) {
            // Show results even if empty
            return (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                {filteredExercises.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    {selectedCategory && !searchQuery && (
                      <div className="sticky top-0 flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Showing {selectedCategory.type === 'muscle' 
                            ? selectedCategory.value 
                            : selectedCategory.value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                          } exercises
                        </span>
                        <button
                          onClick={() => {
                            setSelectedCategory(null);
                            setSearchQuery('');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    <div>
                      {filteredExercises.map((ex: Exercise) => (
                        <button
                          key={ex.id}
                          onClick={() => handleExerciseClick(ex)}
                          className={`w-full px-4 py-2.5 text-left transition-all ${
                            selectedId === ex.id 
                              ? 'bg-gray-100 dark:bg-gray-800 border-l-4 border-green-500' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{ex.name || ex.exerciseName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {ex.primaryMuscle?.toLowerCase().replace(/_/g, ' ')}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      No exercises found
                    </p>
                  </div>
                )}
              </div>
            );
          } else if (!selectedId && categoryMode === 'choice') {
            // Show category choice buttons (temporarily commented out)
            return (
              <div className="space-y-3">
                {/* Temporarily commented out browse options
                <button
                  onClick={() => setCategoryMode('movement')}
                  className="w-full p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Browse by Movement Pattern</h3>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  </div>
                </button>
                
                <button
                  onClick={() => setCategoryMode('muscle')}
                  className="w-full p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Browse by Muscle Group</h3>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  </div>
                </button>
                
                <button
                  onClick={() => setCategoryMode('equipment')}
                  className="w-full p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Browse by Equipment</h3>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  </div>
                </button>
                */}
                
                {/* Placeholder message */}
                <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                  Browse options temporarily disabled. Use search above to find exercises.
                </div>
              </div>
            );
          } else if (!selectedId && categoryMode === 'muscle') {
            // Show muscle groups with back button
            return (
              <div>
                <button
                  onClick={() => {
                    setCategoryMode('choice');
                    setSelectedCategory(null);
                  }}
                  className="mb-3 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Back
                </button>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Muscle Groups</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {MUSCLE_GROUPS.map((muscle) => (
                        <button
                          key={muscle}
                          onClick={() => {
                            setSelectedCategory({ type: 'muscle', value: muscle });
                            setSearchQuery('');
                          }}
                          className="w-full px-4 py-3 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors text-left"
                        >
                          {muscle}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          } else if (!selectedId && categoryMode === 'movement') {
            // Show movement patterns with back button
            return (
              <div>
                <button
                  onClick={() => {
                    setCategoryMode('choice');
                    setSelectedCategory(null);
                  }}
                  className="mb-3 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Back
                </button>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Movement Patterns</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {MOVEMENT_PATTERNS.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => {
                            setSelectedCategory({ type: 'movement', value });
                            setSearchQuery('');
                          }}
                          className="w-full px-4 py-3 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors text-left"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          } else if (!selectedId && categoryMode === 'equipment') {
            // Show equipment options with back button
            return (
              <div>
                <button
                  onClick={() => {
                    setCategoryMode('choice');
                    setSelectedCategory(null);
                  }}
                  className="mb-3 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Back
                </button>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Equipment</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {EQUIPMENT_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => {
                            setSelectedCategory({ type: 'equipment', value });
                            setSearchQuery('');
                          }}
                          className="w-full px-4 py-3 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors text-left"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          // If exercise is selected, don't show anything extra (parent handles confirmation UI)
          return null;
        })()}
      </div>
    </div>
  );
}