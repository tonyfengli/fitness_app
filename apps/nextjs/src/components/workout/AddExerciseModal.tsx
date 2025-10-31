"use client";

import React, { useState, useEffect } from "react";
import { 
  XIcon, 
  ChevronRightIcon, 
  ChevronLeftIcon, 
  SpinnerIcon,
  filterExercisesBySearch,
  MUSCLE_UNIFICATION
} from "@acme/ui-shared";

// Types
interface Exercise {
  id: string;
  exerciseName: string;
  exerciseId?: string;
  orderIndex?: number;
  repsPlanned?: number;
  stationExercises?: Exercise[];
}

interface RoundData {
  roundName: string;
  exercises: Exercise[];
  roundType?: string;
}

interface SelectedCategory {
  type: 'muscle' | 'movement' | 'equipment';
  value: string;
}

interface AddExerciseModalProps {
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

// Helper function from the original code
function getUnifiedMuscleGroup(primaryMuscle: string | undefined): string {
  if (!primaryMuscle) return "Other";
  
  // First check if it's already a unified muscle
  const capitalizedMuscle = primaryMuscle.charAt(0).toUpperCase() + primaryMuscle.slice(1).toLowerCase();
  if (MUSCLE_UNIFICATION[capitalizedMuscle]) {
    return MUSCLE_UNIFICATION[capitalizedMuscle];
  }
  
  // Check various case formats
  const upperMuscle = primaryMuscle.toUpperCase();
  const lowerMuscle = primaryMuscle.toLowerCase();
  const underscoreMuscle = primaryMuscle.replace(/ /g, '_');
  
  // Try different formats
  if (MUSCLE_UNIFICATION[primaryMuscle]) return MUSCLE_UNIFICATION[primaryMuscle];
  if (MUSCLE_UNIFICATION[capitalizedMuscle]) return MUSCLE_UNIFICATION[capitalizedMuscle];
  if (MUSCLE_UNIFICATION[underscoreMuscle]) return MUSCLE_UNIFICATION[underscoreMuscle];
  
  // If not in unification map, it might already be a primary muscle
  // Capitalize it properly
  return primaryMuscle.charAt(0).toUpperCase() + primaryMuscle.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function AddExerciseModal({
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
}: AddExerciseModalProps) {
  // Internal state for search and selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const [categoryMode, setCategoryMode] = useState<'choice' | 'muscle' | 'movement' | 'equipment'>('choice');

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedId(null);
      setSelectedCategory(null);
      setCategoryMode('choice');
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.scrollTo({ top: 0, behavior: 'instant' });
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    setSearchQuery("");
    setSelectedId(null);
    setSelectedCategory(null);
    setCategoryMode('choice');
    onClose();
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
          console.log('[AddExercise] Creating new station:', {
            currentStations: uniqueStations.size,
            targetStationIndex: targetStation,
            uniqueOrderIndexes: Array.from(uniqueStations).sort((a, b) => a - b),
            exerciseName: selectedId ? 'Selected from list' : searchQuery.trim()
          });
          mutations.addToRound.mutate({
            sessionId: sessionId || "",
            clientId: userId || "",
            roundName: roundName,
            newExerciseId: selectedId,
            customName: selectedId ? undefined : searchQuery.trim()
          });
        } else {
          // Adding to existing station
          console.log('[AddExercise] Adding to existing station:', {
            targetStationIndex: targetStation,
            currentStations: uniqueStations.size,
            uniqueOrderIndexes: Array.from(uniqueStations).sort((a, b) => a - b),
            exerciseName: selectedId ? 'Selected from list' : searchQuery.trim(),
            // Enhanced debugging for station mapping
            detailedStationInfo: {
              allExercises: roundData.exercises.map(ex => ({
                exerciseName: ex.exerciseName,
                orderIndex: ex.orderIndex,
                id: ex.id
              })),
              stationMapping: (() => {
                const stations: Record<number, any[]> = {};
                roundData.exercises.forEach((ex, i) => {
                  if (!stations[ex.orderIndex]) {
                    stations[ex.orderIndex] = [];
                  }
                  stations[ex.orderIndex].push({
                    exerciseIndex: i,
                    exerciseName: ex.exerciseName,
                    id: ex.id
                  });
                });
                return stations;
              })(),
              targetOrderIndex: (() => {
                const sortedOrderIndexes = Array.from(uniqueStations).sort((a, b) => a - b);
                return sortedOrderIndexes[targetStation];
              })()
            }
          });
          mutations.addToStation.mutate({
            sessionId: sessionId || "",
            clientId: userId || "",
            roundName: roundName,
            targetStationIndex: targetStation,
            newExerciseId: selectedId,
            customName: selectedId ? undefined : searchQuery.trim()
          });
        }
      } else {
        // Add to end of round (for circuit/amrap rounds)
        mutations.addToRound.mutate({
          sessionId: sessionId || "",
          clientId: userId || "",
          roundName: roundName,
          newExerciseId: selectedId,
          customName: selectedId ? undefined : searchQuery.trim()
        });
      }
    }
  };

  const isLoading = mutations.addToStation.isPending || mutations.addToRound.isPending;

  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal - Full Screen on Mobile */}
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          <div className="flex-1">
            <div className="space-y-4">
              {/* Header showing target */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {(() => {
                      if (roundData?.roundType === 'stations_round') {
                        // Check if we're creating a new station
                        const uniqueStations = new Set(roundData.exercises.map(ex => ex.orderIndex));
                        const isNewStation = targetStation >= uniqueStations.size;
                        return isNewStation 
                          ? `Create Station ${targetStation + 1}`
                          : `Add Exercise to Station ${targetStation + 1}`;
                      }
                      return `Add Exercise to ${roundName}`;
                    })()}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(() => {
                      if (roundData?.roundType === 'stations_round') {
                        const uniqueStations = new Set(roundData.exercises.map(ex => ex.orderIndex));
                        const isNewStation = targetStation >= uniqueStations.size;
                        return isNewStation
                          ? 'Search and select an exercise for the new station'
                          : 'Search and select an exercise to add to this station';
                      }
                      return 'Search and select an exercise to add to the end of this round';
                    })()}
                  </p>
                </div>
                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-0 ml-4 flex-shrink-0"
                  title="Close"
                >
                  <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              {/* Search input row */}
              <div>
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center text-sm font-semibold text-green-700 dark:text-green-300 flex-shrink-0">
                    +
                  </span>
                  <div className="relative flex-1">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Type exercise name..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (selectedId) {
                          setSelectedId(null);
                        }
                      }}
                      className="w-full bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-100 rounded-lg pl-12 pr-12 py-3 text-lg font-medium text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-900/20 dark:focus:ring-gray-100/20 focus:border-gray-900 dark:focus:border-gray-100 shadow-sm"
                    />
                    {/* Clear button */}
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedId(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <XIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
            </div>
            
            {/* Dynamic content area */}
            <div className="mt-4 flex-1 overflow-hidden">
              {(() => {
                // If exercise is selected OR there's search text, show confirmation and add button
                if (selectedId || searchQuery.trim()) {
                  const selectedExercise = availableExercises.find((ex: any) => ex.id === selectedId);
                  return (
                    <div className="space-y-4">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded">
                            <svg className="w-4 h-4 text-green-700 dark:text-green-400" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {selectedExercise?.name || searchQuery.trim() || "Exercise Selected"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(() => {
                            const isStationsRound = roundData?.roundType === 'stations_round';
                            const isCustom = !selectedId && searchQuery.trim();
                            
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
                      
                      {/* Add Exercise Button */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setSelectedId(null);
                            setSearchQuery("");
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleAddExercise}
                          disabled={(!selectedId && !searchQuery.trim()) || isLoading}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
                        >
                          {(() => {
                            const isStationsRound = roundData?.roundType === 'stations_round';
                            const isCustom = !selectedId && searchQuery.trim();
                            
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
                  );
                }
                // If there's search text or a category selected, show filtered results
                else if ((searchQuery || selectedCategory) && !selectedId) {
                  let filtered = availableExercises;
                  
                  // Apply template type filtering (same as inline editing)
                  filtered = filtered.filter((ex: any) => {
                    // Template type filtering - only circuit exercises
                    if (ex.templateType && ex.templateType.length > 0 && !ex.templateType.includes('circuit')) {
                      return false;
                    }
                    
                    // Exclude warmup-only exercises from regular rounds (same as inline editing)
                    return !ex.functionTags?.includes('warmup_only');
                  });
                  
                  // If there's a search query, it takes priority
                  if (searchQuery) {
                    filtered = filterExercisesBySearch(filtered, searchQuery);
                  } else if (selectedCategory) {
                    // Only apply category filter if there's no search query
                    if (selectedCategory.type === 'muscle') {
                      const unifiedMuscle = selectedCategory.value;
                      filtered = filtered.filter((ex: any) => 
                        getUnifiedMuscleGroup(ex.primaryMuscle) === unifiedMuscle
                      );
                    } else if (selectedCategory.type === 'movement') {
                      filtered = filtered.filter((ex: any) => ex.movementPattern === selectedCategory.value);
                    } else if (selectedCategory.type === 'equipment') {
                      filtered = filtered.filter((ex: any) => {
                        if (!ex.equipment) return false;
                        
                        if (Array.isArray(ex.equipment)) {
                          return ex.equipment.some((eq: string) => 
                            eq && eq.toLowerCase().trim() === selectedCategory.value.toLowerCase()
                          );
                        } else if (typeof ex.equipment === 'string') {
                          const equipmentList = ex.equipment.split(',').map(e => e.trim().toLowerCase());
                          return equipmentList.includes(selectedCategory.value.toLowerCase());
                        }
                        
                        return false;
                      });
                    }
                  }
                  
                  // Show results even if empty
                  return (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                      {filtered.length > 0 ? (
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
                            {filtered.map((ex: any) => (
                              <button
                                key={ex.id}
                                onClick={() => {
                                  setSearchQuery(ex.name);
                                  setSelectedId(ex.id);
                                }}
                                className={`w-full px-4 py-2.5 text-left transition-all ${
                                  selectedId === ex.id 
                                    ? 'bg-gray-100 dark:bg-gray-800 border-l-4 border-green-500' 
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                }`}
                              >
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{ex.name}</div>
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
                          {searchQuery.trim() && (
                            <div className="mt-4">
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                                Create a custom exercise instead?
                              </p>
                              <button
                                onClick={() => {
                                  // Trigger the same flow as the main add button
                                  // This will show the confirmation UI since searchQuery has a value
                                  setSelectedCategory(null);
                                  setCategoryMode('choice');
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                              >
                                Add "{searchQuery.trim()}" as Custom Exercise
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                } else if (!selectedId && categoryMode === 'choice') {
                  // Show category choice buttons
                  return (
                    <div className="space-y-3">
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
                            {['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Core', 'Calves'].map((muscle) => (
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
                            {[
                              { value: 'horizontal_push', label: 'Horizontal Push' },
                              { value: 'horizontal_pull', label: 'Horizontal Pull' },
                              { value: 'vertical_push', label: 'Vertical Push' },
                              { value: 'vertical_pull', label: 'Vertical Pull' },
                              { value: 'squat', label: 'Squat' },
                              { value: 'hinge', label: 'Hinge' },
                              { value: 'lunge', label: 'Lunge' },
                              { value: 'core', label: 'Core' },
                              { value: 'carry', label: 'Carry' },
                              { value: 'isolation', label: 'Isolation' }
                            ].map(({ value, label }) => (
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
                            {[
                              { value: 'dumbbells', label: 'Dumbbells' },
                              { value: 'kettlebell', label: 'Kettlebell' },
                              { value: 'bands', label: 'Bands' },
                              { value: 'box', label: 'Box' },
                              { value: 'bench', label: 'Bench' }
                            ].map(({ value, label }) => (
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
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}