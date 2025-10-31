"use client";

import { useState } from "react";
import { 
  XIcon, 
  ChevronRightIcon, 
  ChevronLeftIcon, 
  SpinnerIcon,
  filterExercisesBySearch,
  MUSCLE_UNIFICATION,
  replaceExercise
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

// Helper function from the original code
function getUnifiedMuscleGroup(primaryMuscle: string | undefined): string {
  if (!primaryMuscle) return '';
  return (MUSCLE_UNIFICATION as any)[primaryMuscle] || primaryMuscle;
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
  // Internal state for search and selection
  const [inlineSearchQuery, setInlineSearchQuery] = useState("");
  const [inlineSelectedId, setInlineSelectedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const [categoryMode, setCategoryMode] = useState<'choice' | 'muscle' | 'movement' | 'equipment'>('choice');

  const handleReplace = async () => {
    if ((inlineSelectedId || inlineSearchQuery.trim()) && exercise && round) {
      try {
        await replaceExercise({
          exercise: exercise,
          newExerciseId: inlineSelectedId || null,
          customName: inlineSelectedId ? undefined : inlineSearchQuery.trim(),
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
    setInlineSearchQuery("");
    setInlineSelectedId(null);
    setSelectedCategory(null);
    setCategoryMode('choice');
    onCancel();
  };

  const isReplacing = mutations.swapSpecific.isPending || mutations.swapCircuit.isPending;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
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
      <div className="flex-1 overflow-hidden p-6 flex flex-col">
        <div className="flex-1">
          <div className="space-y-4">
            {/* Search input row */}
            <div>
              <div className="flex items-center gap-4">
                <span className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
                  {exerciseIndex + 1}
                </span>
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Type exercise name..."
                    value={inlineSearchQuery}
                    onChange={(e) => {
                      setInlineSearchQuery(e.target.value);
                      // Clear selection when typing
                      if (inlineSelectedId) {
                        setInlineSelectedId(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        handleCancel();
                      }
                    }}
                    className="w-full bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-100 rounded-lg pl-12 pr-12 py-3 text-lg font-medium text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-900/20 dark:focus:ring-gray-100/20 focus:border-gray-900 dark:focus:border-gray-100 shadow-sm"
                  />
                  {/* Clear button */}
                  {inlineSearchQuery && (
                    <button
                      onClick={() => {
                        setInlineSearchQuery("");
                        setInlineSelectedId(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <XIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Replace button */}
            <div className="ml-16 mt-3">
              <button
                onClick={handleReplace}
                disabled={(!inlineSelectedId && !inlineSearchQuery.trim()) || isReplacing}
                className={`h-12 px-10 text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-0 ${
                  (inlineSelectedId || inlineSearchQuery.trim()) && !isReplacing
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
          
          {/* Dynamic content area - shows either search results or muscle groups */}
          <div className="mt-4 flex-1 overflow-hidden">
            {(() => {
              // If there's search text or a category selected, show filtered results
              if ((inlineSearchQuery || selectedCategory) && !inlineSelectedId) {
                const isReplacingWarmup = round?.roundName === 'Warm-up';
                
                let filtered = availableExercises.filter((ex: any) => {
                  // Template type filtering
                  if (ex.templateType && ex.templateType.length > 0 && !ex.templateType.includes('circuit')) {
                    return false;
                  }
                  
                  if (isReplacingWarmup) {
                    return ex.movementTags?.includes('warmup_friendly') || ex.functionTags?.includes('warmup_only');
                  } else {
                    return !ex.functionTags?.includes('warmup_only');
                  }
                });
                
                // If there's a search query, it takes priority - search all exercises
                if (inlineSearchQuery) {
                  filtered = filterExercisesBySearch(filtered, inlineSearchQuery);
                } else if (selectedCategory) {
                  // Only apply category filter if there's no search query
                  if (selectedCategory.type === 'muscle') {
                    filtered = filtered.filter((ex: any) => {
                      const unifiedMuscle = getUnifiedMuscleGroup(ex.primaryMuscle);
                      return unifiedMuscle === selectedCategory.value;
                    });
                  } else if (selectedCategory.type === 'movement') {
                    filtered = filtered.filter((ex: any) => ex.movementPattern === selectedCategory.value);
                  } else if (selectedCategory.type === 'equipment') {
                    filtered = filtered.filter((ex: any) => {
                      // More robust equipment checking
                      if (!ex.equipment) return false;
                      
                      // Handle different equipment formats
                      if (Array.isArray(ex.equipment)) {
                        // Array format: ["Barbell", "Dumbbell"]
                        return ex.equipment.some((eq: string) => 
                          eq && eq.toLowerCase().trim() === selectedCategory.value.toLowerCase()
                        );
                      } else if (typeof ex.equipment === 'string') {
                        // String format: might be single equipment or comma-separated
                        const equipmentList = ex.equipment.split(',').map((e: string) => e.trim().toLowerCase());
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
                        {selectedCategory && !inlineSearchQuery && (
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
                                setInlineSearchQuery('');
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
                                setInlineSearchQuery(ex.name);
                                setInlineSelectedId(ex.id);
                              }}
                              className={`w-full px-4 py-2.5 text-left transition-all ${
                                inlineSelectedId === ex.id 
                                  ? 'bg-gray-100 dark:bg-gray-800 border-l-4 border-gray-900 dark:border-gray-100' 
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
                          No exercises found for {(() => {
                            if (selectedCategory?.type === 'muscle') {
                              return selectedCategory.value;
                            } else if (selectedCategory?.type === 'equipment') {
                              // Format equipment value for display
                              return selectedCategory.value.split('_').map(word => 
                                word.charAt(0).toUpperCase() + word.slice(1)
                              ).join(' ');
                            } else {
                              return selectedCategory?.value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                            }
                          })()}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {selectedCategory?.type === 'movement' && 'Movement patterns may not be assigned to all exercises'}
                          {selectedCategory?.type === 'equipment' && 'Equipment may not be specified for all exercises'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              } else if (!inlineSelectedId && categoryMode === 'choice') {
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
              } else if (!inlineSelectedId && categoryMode === 'muscle') {
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
                                setInlineSearchQuery('');
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
              } else if (!inlineSelectedId && categoryMode === 'movement') {
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
                                setInlineSearchQuery('');
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
              } else if (!inlineSelectedId && categoryMode === 'equipment') {
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
                                setInlineSearchQuery('');
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
              // If exercise is selected, don't show anything extra
            })()}
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