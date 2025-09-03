"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BaseModal } from './BaseModal';

interface MuscleHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  clientId: string;
  api: any; // tRPC client instance
}

// Simplified muscle groups for UI (unified from 13 system muscles)
const MUSCLES = [
  'Glutes',      // Unified: Glutes + Hips
  'Quads', 
  'Hamstrings', 
  'Calves',
  'Core',        // Unified: Core + Obliques
  'Chest', 
  'Shoulders',   // Unified: Shoulders + Traps
  'Back',
  'Biceps',
  'Triceps'
];

const MUSCLE_GROUPS = {
  upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  lower: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  core: ['Core']
};

// Mapping from system muscles to simplified UI muscles
export const MUSCLE_UNIFICATION: Record<string, string> = {
  'Hips': 'Glutes',
  'Obliques': 'Core',
  'Traps': 'Shoulders',
  'Lats': 'Back',
  'Lower_back': 'Back',
  'Upper_back': 'Back',
  'Delts': 'Shoulders',
  'Adductors': 'Glutes',
  'Abductors': 'Glutes',
  'Lower_abs': 'Core',
  'Upper_abs': 'Core',
  'Upper_chest': 'Chest',
  'Lower_chest': 'Chest',
  'Shins': 'Calves',
  'Tibialis_anterior': 'Calves'
};

type TimeRange = '7' | '14' | '30' | 'custom';

export const MuscleHistoryModal: React.FC<MuscleHistoryModalProps> = ({
  isOpen,
  onClose,
  clientName,
  clientId,
  api
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('7');
  const [isWeeklyMode, setIsWeeklyMode] = useState(true); // Default to This Week
  const [showBarGraph, setShowBarGraph] = useState(false);
  const [showPastWorkouts, setShowPastWorkouts] = useState(false);

  // Calculate date range
  const calculateDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate: Date;
    let endDate: Date;

    if (isWeeklyMode) {
      // This week mode (Monday to Sunday)
      const day = today.getDay();
      const offset = day === 0 ? 6 : day - 1;
      startDate = new Date(today);
      startDate.setDate(today.getDate() - offset);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      // Rolling window mode
      endDate = today;
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (Number(selectedRange) - 1));
    }

    return { startDate, endDate };
  };

  const { startDate, endDate } = calculateDateRange();

  // Fetch muscle coverage data using React Query
  const { data: rawData, isLoading } = useQuery({
    ...api.muscleCoverage.getClientMuscleCoverage.queryOptions({
      clientId,
      startDate,
      endDate,
      includeExercises: true, // Request exercise details
    }),
    enabled: isOpen && !!clientId,
  });

  // Process muscle data including draft scores
  const muscleData = React.useMemo(() => {
    if (!rawData?.muscleScores) return { completed: {}, draft: {} };
    
    const processedCounts: Record<string, number> = {};
    const processedDraftCounts: Record<string, number> = {};
    
    // Initialize all muscles to 0
    MUSCLES.forEach(muscle => {
      processedCounts[muscle] = 0;
      processedDraftCounts[muscle] = 0;
    });

    // Add completed scores from API, applying unification
    Object.entries(rawData.muscleScores).forEach(([muscle, score]) => {
      const muscleKey = muscle.charAt(0).toUpperCase() + muscle.slice(1);
      const unifiedMuscle = MUSCLE_UNIFICATION[muscleKey] || muscleKey;
      
      if (processedCounts[unifiedMuscle] !== undefined) {
        processedCounts[unifiedMuscle] += score as number;
      }
    });

    // Add draft scores from API, applying unification
    if (rawData.muscleDraftScores) {
      Object.entries(rawData.muscleDraftScores).forEach(([muscle, score]) => {
        const muscleKey = muscle.charAt(0).toUpperCase() + muscle.slice(1);
        const unifiedMuscle = MUSCLE_UNIFICATION[muscleKey] || muscleKey;
        
        if (processedDraftCounts[unifiedMuscle] !== undefined) {
          processedDraftCounts[unifiedMuscle] += score as number;
        }
      });
    }

    return { completed: processedCounts, draft: processedDraftCounts };
  }, [rawData]);

  // Extract workout data from the same API response
  const workoutData = React.useMemo(() => {
    if (!rawData?.exercises) return [];
    
    // Group exercises by date and workout
    const workoutsByDate = new Map<string, Array<any>>();
    
    rawData.exercises.forEach((exercise: any) => {
      const date = new Date(exercise.createdAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      if (!workoutsByDate.has(date)) {
        workoutsByDate.set(date, []);
      }
      
      // Format muscle names for display
      const formattedPrimary = exercise.primaryMuscle ? 
        exercise.primaryMuscle.charAt(0).toUpperCase() + exercise.primaryMuscle.slice(1) : 
        'Unknown';
      const unifiedPrimary = MUSCLE_UNIFICATION[formattedPrimary] || formattedPrimary;
      
      // Process secondary muscles
      const formattedSecondary = (exercise.secondaryMuscles || []).map((muscle: string) => {
        const formatted = muscle.charAt(0).toUpperCase() + muscle.slice(1);
        return MUSCLE_UNIFICATION[formatted] || formatted;
      });
      
      workoutsByDate.get(date)?.push({
        ...exercise,
        displayMuscle: unifiedPrimary,
        displaySecondaryMuscles: formattedSecondary,
      });
    });
    
    // Convert to array and sort by date (newest first)
    return Array.from(workoutsByDate.entries())
      .map(([date, exercises]) => ({ date, exercises }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawData]);
  const muscleCounts = muscleData.completed || {};
  const muscleDraftCounts = muscleData.draft || {};

  const formatDateRange = (start: Date, end: Date) => {
    const formatDate = (date: Date) => 
      `${date.toLocaleString('en-US', { month: 'short' })} ${date.getDate()}`;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isWeeklyMode) {
      // Format as "This Week (Mon–Today)" when appropriate
      const isCurrentWeek = end.getTime() >= today.getTime();
      
      if (isCurrentWeek && start.getDay() === 1) {
        return `This Week (Mon–Today)`;
      }
      return `${formatDate(start)} – ${formatDate(end)}`;
    }
    return `Last ${selectedRange} days • ${formatDate(start)} – ${formatDate(end)}`;
  };

  const MuscleProgressDots = ({ count }: { count: number }) => {
    // Calculate full and partial bubbles
    const fullBubbles = Math.floor(count);
    const hasPartialBubble = count % 1 !== 0;
    const partialValue = count % 1;
    
    // Show at least 3 bubbles for aesthetics, more if needed
    const totalBubbles = Math.max(3, Math.ceil(count));
    
    return (
      <div className="flex gap-1">
        {Array.from({ length: totalBubbles }, (_, i) => {
          let bubbleClass = 'h-2 w-2 rounded-full transition-all ';
          
          if (i < fullBubbles) {
            // Full green bubble
            bubbleClass += 'bg-green-500';
          } else if (i === fullBubbles && hasPartialBubble) {
            // Partial bubble with 30% opacity
            bubbleClass += 'bg-green-500 opacity-30';
          } else {
            // Empty bubble
            bubbleClass += 'bg-gray-200';
          }
          
          return <div key={i} className={bubbleClass} />;
        })}
      </div>
    );
  };

  const MuscleBarGraph = ({ muscle, count, maxCount }: { muscle: string; count: number; maxCount: number }) => {
    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
    const hasActivity = count > 0;
    // Round down for display in bar graph
    const displayCount = Math.floor(count);
    
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">{muscle}</span>
          <span className="text-xs text-gray-500">
            {displayCount} {displayCount === 1 ? 'exercise' : 'exercises'}
          </span>
        </div>
        <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${
              hasActivity ? 'bg-gradient-to-r from-indigo-500 to-indigo-600' : 'bg-gray-300'
            }`}
            style={{ width: `${Math.max(percentage, hasActivity ? 10 : 0)}%` }}
          />
          {!hasActivity && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-500">No activity</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const MuscleCard = ({ muscle, count, draftCount = 0 }: { muscle: string; count: number; draftCount?: number }) => {
    const totalCount = count + draftCount;
    const hasDraft = draftCount > 0;
    
    return (
      <div
        className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
          totalCount === 0
            ? 'border-red-500 bg-red-50' 
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{muscle}</span>
          {hasDraft && (
            <span className="text-xs text-gray-500">
              +{draftCount % 1 === 0 ? draftCount : draftCount.toFixed(1)}
            </span>
          )}
        </div>
        <MuscleProgressDots count={totalCount} />
      </div>
    );
  };

  const content = (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-4">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-sm text-gray-600">Loading muscle data...</p>
            </div>
          </div>
        )}
        
        {/* Content when loaded */}
        {!isLoading && (
          <>
        {/* Date range label */}
        <p className="text-sm text-gray-600 mb-4">
          {formatDateRange(startDate, endDate)}
        </p>

        {/* Time range selector */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-2 mr-auto">
            <button
              onClick={() => {
                setIsWeeklyMode(!isWeeklyMode);
                setSelectedRange('7');
                setShowBarGraph(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                isWeeklyMode 
                  ? 'border-gray-300 bg-gray-100 text-gray-900' 
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">📅</span>
              This Week
            </button>
          </div>

          <button
            onClick={() => {
              setSelectedRange('7');
              setIsWeeklyMode(false);
              setShowBarGraph(false);
            }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
              selectedRange === '7' && !isWeeklyMode
                ? 'border-gray-300 bg-gray-100 text-gray-900' 
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            7d
          </button>
          <button
            onClick={() => {
              setSelectedRange('14');
              setIsWeeklyMode(false);
              setShowBarGraph(false);
            }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
              selectedRange === '14' && !isWeeklyMode
                ? 'border-gray-300 bg-gray-100 text-gray-900' 
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            14d
          </button>
          <button
            onClick={() => {
              setSelectedRange('30');
              setIsWeeklyMode(false);
              setShowBarGraph(true);
            }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
              selectedRange === '30' && !isWeeklyMode
                ? 'border-gray-300 bg-gray-100 text-gray-900' 
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            30d
          </button>
        </div>

        {/* Coverage section */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            {showBarGraph ? '30-Day Progress' : 'Coverage'}
          </h3>

          {showBarGraph ? (
            // Bar graph view for 30 days
            <>
              {/* Calculate max count for scaling */}
              {(() => {
                const maxCount = Math.max(...Object.values(muscleCounts), 1);
                return (
                  <>
                    {/* Upper Body */}
                    <div className="mb-6">
                      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                        Upper Body
                      </h4>
                      <div className="space-y-3">
                        {MUSCLE_GROUPS.upper.map(muscle => (
                          <MuscleBarGraph 
                            key={muscle} 
                            muscle={muscle} 
                            count={muscleCounts[muscle] || 0}
                            maxCount={maxCount}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Lower Body */}
                    <div className="mb-6">
                      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                        Lower Body
                      </h4>
                      <div className="space-y-3">
                        {MUSCLE_GROUPS.lower.map(muscle => (
                          <MuscleBarGraph 
                            key={muscle} 
                            muscle={muscle} 
                            count={muscleCounts[muscle] || 0}
                            maxCount={maxCount}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Core */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                        Core
                      </h4>
                      <div className="space-y-3">
                        {MUSCLE_GROUPS.core.map(muscle => (
                          <MuscleBarGraph 
                            key={muscle} 
                            muscle={muscle} 
                            count={muscleCounts[muscle] || 0}
                            maxCount={maxCount}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            // Card view for 7d, 14d, and This Week
            <>
              {/* Upper Body */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Upper Body
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {MUSCLE_GROUPS.upper.map(muscle => (
                    <MuscleCard 
                      key={muscle} 
                      muscle={muscle} 
                      count={muscleCounts[muscle] || 0}
                      draftCount={muscleDraftCounts[muscle] || 0}
                    />
                  ))}
                </div>
              </div>

              {/* Lower Body */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Lower Body
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {MUSCLE_GROUPS.lower.map(muscle => (
                    <MuscleCard 
                      key={muscle} 
                      muscle={muscle} 
                      count={muscleCounts[muscle] || 0}
                      draftCount={muscleDraftCounts[muscle] || 0}
                    />
                  ))}
                </div>
              </div>

              {/* Core */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Core
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {MUSCLE_GROUPS.core.map(muscle => (
                    <MuscleCard 
                      key={muscle} 
                      muscle={muscle} 
                      count={muscleCounts[muscle] || 0}
                      draftCount={muscleDraftCounts[muscle] || 0}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Past Workouts Section */}
        {showPastWorkouts && (
          <div className="mt-6">
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Past Workouts</h3>
                <span className="text-xs text-gray-500">
                  {workoutData.reduce((acc, { exercises }) => acc + exercises.length, 0)} exercises
                </span>
              </div>
              
              {workoutData.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No workouts found in this time period</p>
              ) : (
                <div className="space-y-3">
                  {workoutData.map(({ date, exercises }) => (
                    <div key={date} className="bg-gray-50 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">{date}</h4>
                      <div className="space-y-1.5">
                        {exercises.map((exercise: any, idx: number) => {
                          const muscleCount = muscleCounts[exercise.displayMuscle] || 0;
                          const isUncovered = muscleCount === 0;
                          
                          return (
                            <div key={idx} className="flex items-center justify-between text-sm py-1">
                              <span className="text-gray-700 flex-1 mr-2">{exercise.name}</span>
                              <div className="flex items-center gap-1">
                                {/* Show warning if muscle not covered */}
                                {isUncovered && (
                                  <span className="text-red-500 text-xs mr-1">!</span>
                                )}
                                {/* Primary muscle */}
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  MUSCLE_GROUPS.upper.includes(exercise.displayMuscle) ? 'bg-blue-100 text-blue-700' :
                                  MUSCLE_GROUPS.lower.includes(exercise.displayMuscle) ? 'bg-green-100 text-green-700' :
                                  MUSCLE_GROUPS.core.includes(exercise.displayMuscle) ? 'bg-purple-100 text-purple-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {exercise.displayMuscle}
                                </span>
                                {/* Secondary muscle count bubble */}
                                {exercise.displaySecondaryMuscles?.length > 0 && (
                                  <span className="text-xs px-1.5 py-1 rounded-full bg-gray-100 text-gray-600">
                                    +{exercise.displaySecondaryMuscles.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                </div>
              )}
            </div>
          </div>
        )}
        
        </>
        )}
      </div>
      
      {/* Separator and button section */}
      <div className="border-t border-gray-200 mt-6">
        <div className="px-6 py-4">
          <div className="flex justify-center">
            <button
              onClick={() => setShowPastWorkouts(!showPastWorkouts)}
              className="w-[90%] rounded-lg bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <span>{showPastWorkouts ? 'Hide' : 'Show'} Past Workouts</span>
              <span className="text-xs">{showPastWorkouts ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Targets to Hit"
      className="max-h-[90vh]"
    >
      {content}
    </BaseModal>
  );
};