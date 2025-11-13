"use client";

import React, { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  Button, 
  Loader2Icon as Loader2,
  ChevronLeftIcon,
  ChevronRightIcon,
  useRealtimeExerciseSwaps,
  useRealtimeCircuitConfig,
  SpinnerIcon,
  XIcon,
  filterExercisesBySearch,
  cn,
  MUSCLE_UNIFICATION,
  // New utility imports
  isStationsRound,
  replaceExercise,
  nestStationExercises,
  type RoundData,
  type CircuitConfig,
} from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";
import { api, useTRPC } from "~/trpc/react";
import { toast } from "sonner";
import { CircuitHeader } from "~/components/CircuitHeader";
import { OptionsDrawer } from "~/components/workout/OptionsDrawer";
import { RepsConfiguration } from "~/components/workout/RepsConfiguration";
import { ExerciseReplacement } from "~/components/workout/ExerciseReplacement";
import { AddExerciseDrawer } from "~/components/workout/AddExerciseDrawer";
import { AddRoundDrawer } from "~/components/workout/AddRoundDrawer";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { DurationInput } from "~/components/workout/DurationInput";
import { SessionNameEditor } from "~/components/workout/SessionNameEditor";
import { TimerBadge } from "~/components/workout/TimerBadge";
import { useScrollManager } from "~/hooks/useScrollManager";
import { TabNavigation } from "@acme/ui-shared";
import { WorkoutTab } from "~/components/workout/WorkoutTab";
import { LightingTab } from "~/components/workout/LightingTab";
import { LightingConfigDrawer } from "~/components/workout/LightingConfigDrawer";


// World-class Circuit Timer Calculator Component
interface CircuitTimerCalculatorProps {
  onApplyToWorkDuration: (seconds: number) => void;
}

function CircuitTimerCalculator({ onApplyToWorkDuration }: CircuitTimerCalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [circuitWork, setCircuitWork] = useState<number | ''>('');
  const [circuitRest, setCircuitRest] = useState<number | ''>('');
  const [circuitSets, setCircuitSets] = useState<number | ''>('');

  // Calculate total circuit time (correct formula: ends on work, no rest after final set)
  const workValue = typeof circuitWork === 'number' ? circuitWork : 0;
  const restValue = typeof circuitRest === 'number' ? circuitRest : 0;
  const setsValue = typeof circuitSets === 'number' ? circuitSets : 0;
  
  // Formula: (work × sets) + (rest × (sets - 1))
  // Example: 3 sets = work + rest + work + rest + work (no final rest)
  const totalCircuitTime = setsValue > 0 
    ? (workValue * setsValue) + (restValue * Math.max(0, setsValue - 1))
    : 0;

  // Format duration for display (same as DurationInput)
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins}m`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleApplyCalculation = () => {
    onApplyToWorkDuration(totalCircuitTime);
    setIsExpanded(false);
  };

  return (
    <div className="space-y-3">
      {/* Simple Toggle Button */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Circuit Timer Calculator
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Hide" : "Show"}
        </Button>
      </div>
      
      {/* Expanded Calculator */}
      {isExpanded && (
        <div className="space-y-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50">
          {/* Circuit Inputs */}
          <div className="grid grid-cols-3 gap-3">
            {/* Work Input */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Work
              </label>
              <input
                type="number"
                value={circuitWork}
                onChange={(e) => {
                  const value = e.target.value;
                  setCircuitWork(value === '' ? '' : parseInt(value) || 0);
                }}
                className={cn(
                  "w-full text-center text-sm font-mono bg-white dark:bg-gray-700",
                  "border-2 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  "transition-all duration-200"
                )}
                min="0"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-0.5">seconds</p>
            </div>

            {/* Rest Input */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Rest
              </label>
              <input
                type="number"
                value={circuitRest}
                onChange={(e) => {
                  const value = e.target.value;
                  setCircuitRest(value === '' ? '' : parseInt(value) || 0);
                }}
                className={cn(
                  "w-full text-center text-sm font-mono bg-white dark:bg-gray-700",
                  "border-2 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  "transition-all duration-200"
                )}
                min="0"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-0.5">seconds</p>
            </div>

            {/* Sets Input */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Sets
              </label>
              <input
                type="number"
                value={circuitSets}
                onChange={(e) => {
                  const value = e.target.value;
                  setCircuitSets(value === '' ? '' : parseInt(value) || 0);
                }}
                className={cn(
                  "w-full text-center text-sm font-mono bg-white dark:bg-gray-700",
                  "border-2 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  "transition-all duration-200"
                )}
                min="1"
                placeholder="1"
              />
              <p className="text-xs text-gray-500 mt-0.5">rounds</p>
            </div>
          </div>
          
          {/* Result and Apply */}
          {totalCircuitTime > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-300">Total Station Time</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                  {formatDuration(totalCircuitTime)}
                </p>
              </div>
              <Button
                onClick={handleApplyCalculation}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to get unified muscle group
const getUnifiedMuscleGroup = (muscle: string | undefined): string => {
  if (!muscle) return "Other";
  
  // First check if it's already a unified muscle
  const capitalizedMuscle = muscle.charAt(0).toUpperCase() + muscle.slice(1).toLowerCase();
  if (MUSCLE_UNIFICATION[capitalizedMuscle]) {
    return MUSCLE_UNIFICATION[capitalizedMuscle];
  }
  
  // Check various case formats
  const upperMuscle = muscle.toUpperCase();
  const lowerMuscle = muscle.toLowerCase();
  const underscoreMuscle = muscle.replace(/ /g, '_');
  
  // Try different formats
  if (MUSCLE_UNIFICATION[muscle]) return MUSCLE_UNIFICATION[muscle];
  if (MUSCLE_UNIFICATION[capitalizedMuscle]) return MUSCLE_UNIFICATION[capitalizedMuscle];
  if (MUSCLE_UNIFICATION[underscoreMuscle]) return MUSCLE_UNIFICATION[underscoreMuscle];
  
  // If not in unification map, it might already be a primary muscle
  // Capitalize it properly
  return muscle.charAt(0).toUpperCase() + muscle.slice(1).toLowerCase().replace(/_/g, ' ');
};

// Circuit timing utilities
function getEffectiveTrackDuration(trackDurationMs: number, hypeTimestamp?: number | null): number {
  if (!hypeTimestamp) {
    return trackDurationMs;
  }
  
  // Track starts 5 seconds before hype moment (matching backend logic)
  const offsetMs = Math.max(0, (hypeTimestamp - 5) * 1000);
  return trackDurationMs - offsetMs;
}

// Remove redundant interfaces - we're using the ones from ui-shared now

function calculateCircuitTiming(
  config: any,
  totalRounds: number
): CircuitTimingResult {
  const rounds: RoundTiming[] = [];
  
  // Convert to milliseconds
  const countdownDurationMs = 6000; // 6 seconds
  const workDurationMs = config.workDuration * 1000;
  const restDurationMs = config.restDuration * 1000;
  const restBetweenRoundsMs = config.restBetweenRounds * 1000;
  
  // Account for repeat rounds
  const effectiveRounds = config.repeatRounds 
    ? Math.min(totalRounds, config.rounds * 2)
    : Math.min(totalRounds, config.rounds);
  
  let currentTimeMs = 0;
  
  for (let i = 0; i < effectiveRounds; i++) {
    const roundNumber = i + 1;
    const countdownStartMs = currentTimeMs;
    const workStartMs = countdownStartMs + countdownDurationMs;
    
    // Calculate round duration
    const roundWorkTimeMs = config.exercisesPerRound * workDurationMs;
    const roundRestTimeMs = (config.exercisesPerRound - 1) * restDurationMs;
    const roundDurationMs = countdownDurationMs + roundWorkTimeMs + roundRestTimeMs;
    
    const endTimeMs = countdownStartMs + roundDurationMs;
    
    rounds.push({
      roundNumber,
      countdownStartMs,
      workStartMs,
      endTimeMs,
      totalDurationMs: roundDurationMs
    });
    
    // Add rest between rounds (except after last round)
    currentTimeMs = endTimeMs;
    if (i < effectiveRounds - 1) {
      currentTimeMs += restBetweenRoundsMs;
    }
  }
  
  // Calculate totals
  const totalWorkTimeMs = effectiveRounds * config.exercisesPerRound * workDurationMs;
  const totalRestTimeMs = 
    (effectiveRounds * (config.exercisesPerRound - 1) * restDurationMs) + // Rest between exercises
    ((effectiveRounds - 1) * restBetweenRoundsMs); // Rest between rounds
  
  return {
    rounds,
    totalWorkoutDurationMs: currentTimeMs,
    totalWorkTimeMs,
    totalRestTimeMs,
  };
}

interface RoundData {
  roundName: string;
  exercises: Array<{
    id: string;
    exerciseId: string;
    exerciseName: string;
    orderIndex: number;
    // For stations rounds, we can have multiple exercises per station
    stationExercises?: Array<{
      id: string;
      exerciseId: string;
      exerciseName: string;
      repsPlanned?: number | null;
    }>;
  }>;
  isRepeat?: boolean;
  roundType?: string;
}

// Group exercises by muscle

function CircuitWorkoutOverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const queryClient = useQueryClient();
  const trpc = api();
  
  // Add exercise to station mutation
  const addExerciseToStationMutation = useMutation({
    ...trpc.workoutSelections.addExerciseToStationPublic.mutationOptions(),
    onMutate: (variables) => {
      console.log('[circuit-workout-overview] ADD EXERCISE TO STATION - Starting mutation');
      console.log('[circuit-workout-overview] Mutation variables:', variables);
      console.log('[circuit-workout-overview] Adding to existing station with orderIndex:', variables.orderIndex);
    },
    onSuccess: (data) => {
      console.log('[circuit-workout-overview] ADD EXERCISE TO STATION - Success');
      console.log('[circuit-workout-overview] Response data:', data);
      
      // Close drawer
      setShowAddExerciseInDrawer(false);
      setShowOptionsDrawer(false);
      setAddExerciseModalConfig(null);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
    },
    onError: (error) => {
      console.error("Failed to add exercise to station:", error);
      alert("Failed to add exercise to station. Please try again.");
    },
  });

  // Add exercise to round mutation (for circuit/amrap rounds)
  const addExerciseToRoundMutation = useMutation({
    ...trpc.workoutSelections.addExerciseToRoundPublic.mutationOptions(),
    onMutate: (variables) => {
      console.log('[circuit-workout-overview] ADD EXERCISE TO ROUND - Starting mutation');
      console.log('[circuit-workout-overview] Mutation variables:', variables);
      console.log('[circuit-workout-overview] Session ID:', sessionId);
      console.log('[circuit-workout-overview] Current round data for round', variables.roundNumber, ':', 
        roundsData.find(r => parseInt(r.roundName.match(/\d+/)?.[0] || '0') === variables.roundNumber));
      
      // Check if this is a stations round
      if (circuitConfig?.config?.roundTemplates) {
        const roundTemplate = circuitConfig.config.roundTemplates.find(
          rt => rt.roundNumber === variables.roundNumber
        );
        console.log('[circuit-workout-overview] Round template:', roundTemplate);
        console.log('[circuit-workout-overview] Is stations round:', roundTemplate?.template?.type === 'stations_round');
        console.log('[circuit-workout-overview] Current stationCircuits before add:', roundTemplate?.template?.stationCircuits);
      }
    },
    onSuccess: (data) => {
      console.log('[circuit-workout-overview] ADD EXERCISE TO ROUND - Success');
      console.log('[circuit-workout-overview] Response data:', data);
      console.log('[circuit-workout-overview] New exercise created with orderIndex:', data?.orderIndex);
      console.log('[circuit-workout-overview] New exercise stationIndex:', data?.stationIndex);
      
      // Close drawer
      setShowAddExerciseInDrawer(false);
      setShowOptionsDrawer(false);
      setAddExerciseModalConfig(null);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Also invalidate circuit config to reflect cleaned up orphaned configs
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Log what happens after refresh
      setTimeout(() => {
        console.log('[circuit-workout-overview] POST-ADD: Checking circuit config after refresh...');
        console.log('[circuit-workout-overview] POST-ADD: Full circuitConfig:', circuitConfig);
        if (circuitConfig?.config?.roundTemplates) {
          console.log('[circuit-workout-overview] POST-ADD: All round templates after refresh:', circuitConfig.config.roundTemplates);
          const roundTemplate = circuitConfig.config.roundTemplates.find(
            rt => rt.roundNumber === data?.roundNumber
          );
          console.log('[circuit-workout-overview] POST-ADD: Target round template after refresh:', roundTemplate);
          console.log('[circuit-workout-overview] POST-ADD: stationCircuits after refresh:', roundTemplate?.template?.stationCircuits);
          
          // Check ALL round templates for stationCircuits
          circuitConfig.config.roundTemplates.forEach(rt => {
            if (rt.template.stationCircuits) {
              console.log('[circuit-workout-overview] POST-ADD: Found stationCircuits in round', rt.roundNumber, ':', rt.template.stationCircuits);
            }
          });
        }
      }, 1000);
    },
    onError: (error) => {
      console.error("[circuit-workout-overview] Failed to add exercise to round:", error);
      alert("Failed to add exercise to round. Please try again.");
    },
  });
  
  const [roundsData, setRoundsData] = useState<RoundData[]>([]);
  const [hasExercises, setHasExercises] = useState(false);
  const [setlist, setSetlist] = useState<any>(null);
  const [timingInfo, setTimingInfo] = useState<any>(null);
  
  // PHASE 3: Modal state variables removed - now using drawer approach
  const availableExercisesRef = useRef<any[]>([]);
  
  // Inline editing state
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [inlineSearchQuery, setInlineSearchQuery] = useState("");
  const [inlineSelectedId, setInlineSelectedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ type: 'muscle' | 'movement' | 'equipment', value: string } | null>(null);
  const [categoryMode, setCategoryMode] = useState<'choice' | 'muscle' | 'movement' | 'equipment'>('choice');
  
  // Session name editing state
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);
  const [editingSessionName, setEditingSessionName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Add exercise modal state (for stations rounds)
  const [addExerciseModalConfig, setAddExerciseModalConfig] = useState<{
    roundName: string;
    roundData: RoundData;
    targetStation: number;
    mode: 'add-to-station' | 'add-to-round' | 'create-station';
  } | null>(null);
  
  // Spotify section expansion state
  const [expandedSpotifyRounds, setExpandedSpotifyRounds] = useState<Set<string>>(new Set());
  
  // Mirror update confirmation state
  const [showMirrorConfirm, setShowMirrorConfirm] = useState(false);
  const [mirrorRoundName, setMirrorRoundName] = useState("");
  const [pendingMirrorSwap, setPendingMirrorSwap] = useState<any>(null);

  // Sets configuration modal state
  const [selectedExerciseForSets, setSelectedExerciseForSets] = useState<{
    id: string;
    exerciseName: string;
    exerciseId: string;
    roundName: string;
  } | null>(null);
  const [repsValue, setRepsValue] = useState(0);
  
  // Modal view state - 'configure' or 'delete'
  
  // Options drawer state (for rounds, stations, and exercises)
  const [showOptionsDrawer, setShowOptionsDrawer] = useState(false);
  const [showRepsInDrawer, setShowRepsInDrawer] = useState(false);
  const [showReplaceInDrawer, setShowReplaceInDrawer] = useState(false);
  const [showAddExerciseInDrawer, setShowAddExerciseInDrawer] = useState(false);
  const [showAddRoundInDrawer, setShowAddRoundInDrawer] = useState(false);
  const [showLightingConfigInDrawer, setShowLightingConfigInDrawer] = useState(false);
  const [selectedLightForConfig, setSelectedLightForConfig] = useState<{
    roundId: number;
    phaseType: string;
    phaseLabel: string;
    currentConfig: any;
  } | null>(null);
  const [selectedItemForOptions, setSelectedItemForOptions] = useState<{
    type: 'round' | 'station' | 'exercise';
    id: string;
    name: string;
    roundName?: string;
    exerciseId?: string;
    repsPlanned?: number;
    roundIndex?: number;
    stationIndex?: number;
  } | null>(null);
  const [selectedExerciseForReplace, setSelectedExerciseForReplace] = useState<{
    id: string;
    exerciseName: string;
    exerciseId: string;
    roundName: string;
    orderIndex: number;
  } | null>(null);

  // Round options modal state
  const [showRoundOptionsModal, setShowRoundOptionsModal] = useState(false);
  const [selectedRoundForOptions, setSelectedRoundForOptions] = useState<RoundData | null>(null);

  // AddRoundDrawer edit mode state
  const [addRoundDrawerEditMode, setAddRoundDrawerEditMode] = useState<{
    roundNumber: number;
    roundData: {
      type: 'circuit_round' | 'stations_round' | 'amrap_round';
      exercisesPerRound: number;
      workDuration?: number;
      restDuration?: number;
      repeatTimes?: number;
      restBetweenSets?: number;
      totalDuration?: number;
    };
    onSave: (config: any) => void;
  } | null>(null);

  // Confirmation dialog state
  const [showDeleteExerciseConfirm, setShowDeleteExerciseConfirm] = useState(false);
  const [showDeleteRoundConfirm, setShowDeleteRoundConfirm] = useState(false);
  const [deleteExerciseData, setDeleteExerciseData] = useState<{id: string; name: string} | null>(null);
  const [deleteRoundData, setDeleteRoundData] = useState<{roundNumber: number; name: string} | null>(null);

  // Global loading states for move operations
  const [movingRoundId, setMovingRoundId] = useState<string | null>(null);
  const [movingExerciseId, setMovingExerciseId] = useState<string | null>(null);

  // Station circuit configuration modal state
  const [showStationCircuitModal, setShowStationCircuitModal] = useState(false);
  const [selectedStationForCircuit, setSelectedStationForCircuit] = useState<{
    roundName: string;
    stationIndex: number;
    stationNumber: number;
    totalWorkDuration: number; // Total time available for the station
  } | null>(null);
  const [stationCircuitConfig, setStationCircuitConfig] = useState({
    workDuration: 40,
    restDuration: 20,
    sets: 3,
  });


  // Set up the reorder mutation for circuits
  const reorderExerciseMutation = useMutation({
    ...trpc.workoutSelections.reorderCircuitExercise.mutationOptions(),
    onMutate: (variables) => {
      // Set loading state for the specific exercise being moved
      const exerciseId = variables.currentIndex.toString();
      setMovingExerciseId(exerciseId);
    },
    onSuccess: () => {
      // Clear loading state
      setMovingExerciseId(null);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelections"]],
      });
      
      toast.success("Exercise order updated successfully");
    },
    onError: (error) => {
      // Clear loading state on error
      setMovingExerciseId(null);
      
      console.error("Failed to reorder exercise:", error);
      alert("Failed to reorder exercise. Please try again.");
    },
  });

  // Set up the update reps mutation
  const updateRepsPlannedMutation = useMutation({
    ...trpc.workoutSelections.updateRepsPlannedPublic.mutationOptions(),
    onSuccess: (updatedExercise, variables) => {
      console.log("[updateRepsPlannedMutation] Success:", updatedExercise);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Close modal
            setSelectedExerciseForSets(null);
    },
    onError: (error) => {
      console.error("Failed to update reps:", error);
      alert("Failed to update reps. Please try again.");
    },
  });

  // Set up the swap mutation for circuits
  const swapExerciseMutation = useMutation({
    ...trpc.workoutSelections.swapCircuitExercise.mutationOptions(),
    onSuccess: (data) => {
      console.log("[swapExerciseMutation] Success! Response:", data);
      
      // Close drawer
      setShowReplaceInDrawer(false);
      setSelectedExerciseForReplace(null);
      
      // Reset inline editing state
      setEditingExerciseId(null);
      setInlineSearchQuery("");
      setInlineSelectedId(null);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
    },
    onError: (error) => {
      console.error("Failed to swap exercise:", error);
      alert("Failed to swap exercise. Please try again.");
    },
  });

  // Set up the swap mutation for specific exercises (stations)
  const swapSpecificExerciseMutation = useMutation({
    ...trpc.workoutSelections.swapSpecificExercise.mutationOptions(),
    onSuccess: (data) => {
      console.log("[swapSpecificExerciseMutation] Success! Response:", data);
      
      // Close drawer
      setShowReplaceInDrawer(false);
      setSelectedExerciseForReplace(null);
      
      // Reset inline editing state
      setEditingExerciseId(null);
      setInlineSearchQuery("");
      setInlineSelectedId(null);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
    },
    onError: (error) => {
      console.error("Failed to swap specific exercise:", error);
      alert("Failed to swap exercise. Please try again.");
    },
  });

  // Set up the delete mutation for circuits
  const deleteCircuitExerciseMutation = useMutation({
    ...trpc.workoutSelections.deleteCircuitExercise.mutationOptions(),
    onSuccess: (data) => {
      
      // Close modal
            setSelectedExerciseForSets(null);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      toast.success("Exercise deleted successfully");
    },
    onError: (error) => {
      console.error("Failed to delete exercise:", error);
      toast.error("Failed to delete exercise. Please try again.");
    },
  });

  // Mutation for updating station circuit configuration
  const updateStationConfigMutation = useMutation({
    ...trpc.circuitConfig.updatePublic.mutationOptions(),
    onSuccess: () => {
      toast.success("Station configuration updated");
      
      // Invalidate circuit config query
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Also invalidate workout selections to trigger full UI refresh
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
    },
    onError: (error: any) => {
      toast.error("Failed to update station configuration");
      console.error("Station config update error:", error);
    },
  });

  // Session name update mutation
  const updateSessionNameMutation = useMutation({
    ...trpc.trainingSession.updateSessionName.mutationOptions(),
    onSuccess: (data) => {
      console.log("[updateSessionName] Success! Response:", data);
      
      // Exit editing mode
      setIsEditingSessionName(false);
      setEditingSessionName("");
      
      // Invalidate session data query to refresh the name
      queryClient.invalidateQueries({
        queryKey: trpc.trainingSession.getSession.queryOptions({ 
          id: sessionId || "" 
        }).queryKey,
      });
      
      toast.success("Session name updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update session name:", error);
      toast.error("Failed to update session name. Please try again.");
    },
  });

  // Handle saving session name
  const handleSaveSessionName = () => {
    if (editingSessionName.trim() && editingSessionName.trim() !== sessionData?.name) {
      updateSessionNameMutation.mutate({
        sessionId: sessionId!,
        name: editingSessionName.trim(),
      });
    } else {
      setIsEditingSessionName(false);
      setEditingSessionName("");
    }
  };

  // Delete round mutation
  const deleteRoundMutation = useMutation({
    ...trpc.circuitConfig.deleteRound.mutationOptions(),
    onSuccess: () => {
      console.log("[deleteRoundMutation] Success!");
      
      // Close modal - following the same pattern as round settings save
      setShowRoundOptionsModal(false);
      setSelectedRoundForOptions(null);
      
      // Show success toast
      toast.success("Round deleted successfully");
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Also invalidate workout selections to trigger full UI refresh
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Invalidate session query as well since it contains templateConfig
      queryClient.invalidateQueries({
        queryKey: trpc.trainingSession.getSession.queryOptions({ 
          id: sessionId || "" 
        }).queryKey,
      });
    },
    onError: (error) => {
      console.error("Failed to delete round:", error);
      toast.error("Failed to delete round. Please try again.");
    },
  });

  // Add round mutation
  const addRoundMutation = useMutation({
    ...trpc.circuitConfig.addRound.mutationOptions(),
    onSuccess: () => {
      console.log("[addRoundMutation] Success!");
      
      // Close drawer and reset state
      setShowAddRoundInDrawer(false);
      setShowOptionsDrawer(false);
      
      // Show success toast
      toast.success("Round added successfully");
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Also invalidate workout selections to trigger full UI refresh
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Invalidate session query as well since it contains templateConfig
      queryClient.invalidateQueries({
        queryKey: trpc.trainingSession.getSession.queryOptions({ 
          id: sessionId || "" 
        }).queryKey,
      });
    },
    onError: (error) => {
      console.error("Failed to add round:", error);
      toast.error("Failed to add round. Please try again.");
    },
  });

  // Update round mutation
  const updateRoundMutation = useMutation({
    ...trpc.circuitConfig.updatePublic.mutationOptions(),
    onSuccess: () => {
      console.log("[updateRoundMutation] Success!");
      
      // Close drawer and reset edit mode
      setShowAddRoundInDrawer(false);
      setAddRoundDrawerEditMode(null);
      setShowOptionsDrawer(false);
      
      // Show success toast
      toast.success("Round settings updated successfully");
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Also invalidate workout selections to trigger full UI refresh
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Invalidate session query as well since it contains templateConfig
      queryClient.invalidateQueries({
        queryKey: trpc.trainingSession.getSession.queryOptions({ 
          id: sessionId || "" 
        }).queryKey,
      });
    },
    onError: (error) => {
      console.error("Failed to update round:", error);
      toast.error("Failed to update round. Please try again.");
    },
  });

  // Round reordering mutation
  const reorderRoundsMutation = useMutation({
    ...trpc.circuitConfig.reorderRounds.mutationOptions(),
    onMutate: (variables) => {
      // Set loading state for the specific round being moved
      const roundId = `round-${variables.currentRoundNumber}`;
      console.log('[reorderRoundsMutation] onMutate called', {
        variables,
        roundId,
        currentMovingRoundId: movingRoundId
      });
      setMovingRoundId(roundId);
    },
    onSuccess: () => {
      console.log('[reorderRoundsMutation] onSuccess called, clearing loading state');
      // Clear loading state
      setMovingRoundId(null);
      
      // Invalidate both circuit config and selections to refresh data
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      toast.success("Round order updated successfully");
    },
    onError: (error) => {
      console.log('[reorderRoundsMutation] onError called, clearing loading state', error);
      // Clear loading state on error
      setMovingRoundId(null);
      
      console.error("Failed to reorder rounds:", error);
      toast.error("Failed to reorder rounds. Please try again.");
    },
  });

  // Use real-time exercise swap updates
  useRealtimeExerciseSwaps({
    sessionId: sessionId || "",
    supabase,
    onSwapUpdate: (swap) => {
      // Force refetch of exercise selections
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
    },
    onError: (error) => {
      console.error("[CircuitWorkoutOverview] Real-time error:", error);
    },
  });

  // Fetch circuit config
  const { data: circuitConfig } = useQuery({
    ...trpc.circuitConfig.getBySession.queryOptions({ sessionId: sessionId || "" }),
    enabled: !!sessionId
  });


  // Fetch session data to get templateConfig with setlist
  const { data: sessionData } = useQuery({
    ...trpc.trainingSession.getSession.queryOptions({ id: sessionId || "" }),
    enabled: !!sessionId
  });

  // Fetch saved selections (for circuit, we don't filter by clientId)
  const { data: savedSelections, isLoading: isLoadingSelections, dataUpdatedAt } = useQuery({
    ...trpc.workoutSelections.getSelections.queryOptions({ sessionId: sessionId || "" }),
    enabled: !!sessionId,
    refetchInterval: !hasExercises ? 5000 : false, // Poll when no exercises
  });


  // Get any user from the saved selections to use for fetching exercises
  // Since circuit exercises are shared, we just need any valid userId from the session
  const dummyUserId = useMemo(() => {
    if (savedSelections && savedSelections.length > 0) {
      // Get the first clientId we find
      return savedSelections[0]?.clientId || "";
    }
    // Fallback to hardcoded trainer ID when no selections exist yet
    return "v4dxeCHAJ31kgL3To8NygjuNNZXZGf9W";
  }, [savedSelections]);

  // Fetch available exercises - always fetch when we have sessionId and userId
  // This prevents race conditions where drawers open before data is loaded
  const { data: exercisesData, isLoading: isLoadingExercises } = useQuery({
    ...trpc.exercise.getAvailablePublic.queryOptions({
      sessionId: sessionId || "",
      userId: dummyUserId || "",
    }),
    enabled: !!sessionId && !!dummyUserId,
    staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes to avoid unnecessary refetches
  });

  const availableExercises = exercisesData?.exercises || [];


  // Keep ref updated with available exercises
  useEffect(() => {
    availableExercisesRef.current = availableExercises;
  }, [availableExercises]);


  // Process setlist and timing from templateConfig
  useEffect(() => {
    if (sessionData?.templateConfig && circuitConfig?.config) {
      const templateConfig = sessionData.templateConfig as any;
      
      // Check for setlist in multiple possible locations
      const setlistData = templateConfig.setlist || 
                         templateConfig.visualizationData?.llmResult?.metadata?.setlist;
      
      if (setlistData) {
        setSetlist(setlistData);
        
        // Calculate timing info
        const timing = calculateCircuitTiming(
          circuitConfig.config,
          setlistData.rounds.length
        );
        setTimingInfo(timing);
      }
    }
  }, [sessionData, circuitConfig]);

  // Process selections into rounds
  useEffect(() => {
    // Wait for both savedSelections AND circuitConfig to be loaded
    // This prevents the race condition where exercises render as regular rounds
    // before being re-rendered as stations rounds
    if (savedSelections && savedSelections.length > 0 && circuitConfig) {
      // Group exercises by round (using groupName)
      const roundsMap = new Map<string, typeof savedSelections>();
      
      // Use all exercises without deduplication to allow duplicates in the same round
      const allExercises = savedSelections;
      
      // Group by round, excluding warm-up exercises
      allExercises.forEach((selection) => {
        const round = selection.groupName || 'Round 1';
        
        
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push(selection);
      });
      
      // Sort exercises within each round and create final structure
      
      let rounds: RoundData[] = Array.from(roundsMap.entries())
        .map(([roundName, exercises]) => {
          // First, sort all exercises by orderIndex
          const sortedExercises = exercises.sort((a: any, b: any) => a.orderIndex - b.orderIndex);
          
          // Use utility function to determine if this is a stations round
          const isStationRound = isStationsRound(roundName, circuitConfig);
          
          if (isStationRound) {
            // Use the nestStationExercises utility to convert flat to nested structure
            const nestedExercises = nestStationExercises(sortedExercises);
            
            return {
              roundName,
              exercises: nestedExercises
            };
          } else {
            // For non-stations rounds, keep original behavior
            return {
              roundName,
              exercises: sortedExercises.map((ex: any) => ({
                id: ex.id,
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName,
                orderIndex: ex.orderIndex,
                custom_exercise: ex.custom_exercise,
                repsPlanned: ex.repsPlanned,
              }))
            };
          }
        })
        .sort((a, b) => {
          // Extract round numbers for sorting
          const aNum = parseInt(a.roundName.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.roundName.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        });
      
      // Calculate base round count for styling purposes
      const baseRoundCount = circuitConfig?.config?.repeatRounds 
        ? Math.floor(rounds.length / 2) 
        : rounds.length;
      
      // Mark which rounds are repeats and get round type
      
      const roundsWithMetadata = rounds.map((round, index) => {
        const actualRoundIndex = circuitConfig?.config?.repeatRounds && index >= baseRoundCount 
          ? index - baseRoundCount 
          : index;
        
        const roundTemplate = circuitConfig?.config?.roundTemplates?.[actualRoundIndex];
        const roundType = roundTemplate?.template?.type || 'circuit_round';
        
        
        return {
          ...round,
          isRepeat: circuitConfig?.config?.repeatRounds && index >= baseRoundCount,
          roundType
        };
      });
      
      setRoundsData(roundsWithMetadata);
      setHasExercises(true);
    }
  }, [savedSelections, circuitConfig]);

  // PHASE 4: Modal exercise filtering logic removed

  // PHASE 4: Modal exercise grouping logic removed

  // PHASE 4: Modal muscle group toggle function removed

  // PHASE 4: Body scroll prevention for modal removed



  // Prevent body scroll when mirror confirm modal is open
  useEffect(() => {
    if (showMirrorConfirm) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [showMirrorConfirm]);

  // Handle escape key to exit session name editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditingSessionName) {
        setIsEditingSessionName(false);
        setEditingSessionName("");
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditingSessionName]);

  // Removed iOS Safari fix for RoundOptionsModal - replaced with unified scroll manager

  // Prevent body scroll when station circuit modal is open
  useEffect(() => {
    if (showStationCircuitModal) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [showStationCircuitModal]);

  // PHASE 4: Modal state reset effect removed

  // Removed automatic scroll-to-top for editingExerciseId

  // Unified scroll management for iOS Safari fixes
  useScrollManager({ 
    isActive: showAddExerciseInDrawer || showOptionsDrawer || showAddRoundInDrawer, 
    priority: 1 
  });

  // Tab state
  const [activeTab, setActiveTab] = useState('workout');
  
  // Tab configuration
  const tabs = [
    { id: 'workout', label: 'Workout' },
    { id: 'lighting', label: 'Lighting' },
  ];


  if (isLoadingSelections) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <CircuitHeader
          onBack={() => {
            // Use router.replace for instant navigation (no back stack delay)
            router.replace(`/circuit-sessions/${sessionId}`);
          }}
          backText="Session"
          title="Circuit Workout"
          subtitle="Loading exercises..."
        />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading circuit exercises...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 to-purple-900 text-white shadow-lg">
        <div className="flex items-center justify-between pl-1 pr-4 py-3">
            <button
              onClick={() => {
                // Use router.replace for instant navigation (no back stack delay)
                // This bypasses the heavy cleanup operations that cause delays
                router.replace(`/circuit-sessions/${sessionId}`);
              }}
              className="flex items-center space-x-2 active:opacity-70 transition-opacity min-w-0 p-2"
            >
              <ChevronLeftIcon className="w-6 h-6 flex-shrink-0" />
              <span className="text-sm font-medium">Back</span>
            </button>
            
            <div className="flex-1 flex justify-center items-center min-w-0">
            {/* Editable Session Name - Primary info hierarchy */}
            {sessionData?.name && (
              <SessionNameEditor
                sessionId={sessionId!}
                sessionName={sessionData.name}
              />
            )}
          </div>
          
          {/* Timer badge moved to top right */}
          <TimerBadge 
            circuitConfig={circuitConfig} 
            roundsData={roundsData} 
          />
        </div>
      </div>

      {/* Content with top padding for header */}
      <div className="pt-16 px-4 pb-8">
        <div className="mx-auto max-w-2xl">
          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-900 mb-4 -mx-4 pt-4">
            <div className="px-4">
              <TabNavigation
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
            </div>
          </div>


        {/* Tab Content */}
        {activeTab === 'workout' ? (
          <WorkoutTab>
            {/* Warm-up Section */}
        {circuitConfig?.config?.warmup?.enabled && (
          <Card className="mt-8 mb-6 p-0 shadow-sm bg-white dark:bg-gray-800">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-orange-500/20 dark:bg-amber-300/20 text-orange-700 dark:text-amber-200 ring-2 ring-orange-400/50 dark:ring-amber-300/40 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 2L10 10M6 6L10 10L14 6M4 14H16M4 18H16" />
                  </svg>
                </span>
                <span>Warm-up</span>
                <span className="ml-auto text-sm font-medium text-gray-600 dark:text-gray-300">
                {Math.floor((circuitConfig.config.warmup.duration || 300) / 60)} minutes
              </span>
              </h2>
              
              <div className="space-y-3">
                <WarmupExercisesList 
                sessionId={sessionId!} 
                onReplaceClick={(exercise, round, exerciseIndex) => {
                  // PHASE 1: Modal trigger disabled - this now does nothing
                  // The drawer replacement should be used instead via OptionsDrawer
                  console.log('[PHASE 1] Modal trigger disabled for:', exercise.exerciseName);
                }}
              />
              </div>
            </div>
          </Card>
        )}

        {/* Content */}
        {isLoadingSelections || !circuitConfig ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
          </div>
        ) : roundsData.length > 0 ? (
          <>

            {/* Rounds Content */}
            <div className="grid gap-6">
            {roundsData.map((round, roundIndex) => {
              // Get music for this round
              const roundMusic = setlist?.rounds?.[roundIndex];
              const roundTiming = timingInfo?.rounds?.[roundIndex];
              
              // Calculate effective duration for HYPE track
              const track1EffectiveDuration = roundMusic?.track1?.durationMs ? getEffectiveTrackDuration(
                roundMusic.track1.durationMs,
                roundMusic.track1.hypeTimestamp
              ) : 0;
              const track1EffectiveSec = Math.floor(track1EffectiveDuration / 1000);
              const track1Minutes = Math.floor(track1EffectiveSec / 60);
              const track1Seconds = track1EffectiveSec % 60;
              
              return (
              <Card 
                key={round.roundName} 
                className={`${roundIndex === 0 ? 'mt-4' : ''} mb-6 p-0 shadow-sm bg-white dark:bg-gray-800`}
              >
                <div className="p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                      <span className="flex items-center gap-2">
                        {round.roundName}
                        {round.isRepeat && (
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-violet-300/20 text-purple-700 dark:text-violet-200 rounded-full">
                            Repeat
                          </span>
                        )}
                      </span>
                      {/* Round options button */}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedItemForOptions({
                              type: 'round',
                              id: round.roundName,
                              name: round.roundName,
                              roundIndex: roundIndex,
                            });
                            setShowOptionsDrawer(true);
                          }}
                          className="p-1.5 sm:p-2 rounded-md sm:rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                          aria-label="Round options"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-gray-600 dark:text-gray-400 sm:w-[18px] sm:h-[18px]"
                          >
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="19" r="1" />
                          </svg>
                        </button>
                      </div>
                    </h2>
                    <div className="mt-3 space-y-3">
                      {(() => {
                        const roundType = round.roundType || 'circuit_round';
                        const roundNumber = parseInt(round.roundName.match(/\d+/)?.[0] || '1');
                        const roundTemplate = circuitConfig?.config?.roundTemplates?.find(rt => rt.roundNumber === roundNumber);
                        
                        
                        return (
                          <>
                            {/* Information Hierarchy */}
                            <div className="flex items-center justify-between">
                              {/* 1. Round Type - Most Prominent */}
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-semibold">
                                {(() => {
                                  switch (roundType) {
                                    case 'amrap_round':
                                      return (
                                        <>
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          AMRAP
                                        </>
                                      );
                                    case 'circuit_round':
                                      return (
                                        <>
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                          </svg>
                                          CIRCUIT
                                        </>
                                      );
                                    case 'stations_round':
                                      return (
                                        <>
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                          </svg>
                                          STATIONS
                                        </>
                                      );
                                    default:
                                      return 'UNKNOWN';
                                  }
                                })()}
                              </span>
                              
                              {/* 2. Total Time - Clear and Prominent */}
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-lg font-bold text-purple-700 dark:text-purple-300">
                                  {(() => {
                                    let totalDuration = 0;
                                    
                                    if (roundType === 'amrap_round') {
                                      totalDuration = roundTemplate?.template?.totalDuration || 0;
                                    } else if (roundType === 'stations_round') {
                                      const workTime = roundTemplate?.template?.workDuration || 0;
                                      const restTime = roundTemplate?.template?.restDuration || 0;
                                      const sets = roundTemplate?.template?.repeatTimes || 1;
                                      const restBetweenSets = roundTemplate?.template?.restBetweenSets || 0;
                                      // For stations rounds, use actual station count
                                      const uniqueStations = new Set(round.exercises.map((ex: any) => ex.orderIndex));
                                      const unitsCount = uniqueStations.size || 1;
                                      // Each set: (stations × work) + (rest after each station except last)
                                      const timePerSet = (unitsCount * workTime) + ((unitsCount - 1) * restTime);
                                      totalDuration = (timePerSet * sets) + (restBetweenSets * (sets - 1));
                                      
                                    } else {
                                      const workTime = roundTemplate?.template?.workDuration || 0;
                                      const restTime = roundTemplate?.template?.restDuration || 0;
                                      const sets = roundTemplate?.template?.repeatTimes || 1;
                                      const restBetweenSets = roundTemplate?.template?.restBetweenSets || 0;
                                      const unitsCount = round.exercises.length;
                                      const timePerSet = (unitsCount * workTime) + ((unitsCount - 1) * restTime);
                                      totalDuration = (timePerSet * sets) + (restBetweenSets * (sets - 1));
                                    }
                                    
                                    const mins = Math.floor(totalDuration / 60);
                                    const secs = totalDuration % 60;
                                    if (mins === 0) {
                                      return `${secs}s`;
                                    } else {
                                      return `${mins}:${secs.toString().padStart(2, '0')}`;
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                            
                            {/* 3. Round Details - Enhanced Clarity */}
                            <div className="space-y-2">
                              {(() => {
                                switch (roundType) {
                                  case 'amrap_round':
                                    return null;
                                  case 'circuit_round':
                                    const workTime = roundTemplate?.template?.workDuration || 0;
                                    const restTime = roundTemplate?.template?.restDuration || 0;
                                    const sets = roundTemplate?.template?.repeatTimes || 1;
                                    const restBetweenSets = roundTemplate?.template?.restBetweenSets || 0;
                                    const formatTimeCircuit = (seconds) => {
                                      if (seconds >= 60) {
                                        const mins = Math.floor(seconds / 60);
                                        const secs = seconds % 60;
                                        if (secs === 0) {
                                          return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
                                        } else {
                                          return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ${secs} ${secs === 1 ? 'second' : 'seconds'}`;
                                        }
                                      }
                                      return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
                                    };
                                    return (
                                      <div className="space-y-1.5">
                                        {/* Primary timing information */}
                                        <div className="flex items-center gap-4 text-sm">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-gray-100">Work:</span>
                                            <span className="text-gray-600 dark:text-gray-400">{formatTimeCircuit(workTime)}</span>
                                          </div>
                                          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-gray-100">Rest:</span>
                                            <span className="text-gray-600 dark:text-gray-400">{formatTimeCircuit(restTime)}</span>
                                          </div>
                                        </div>
                                        
                                        {/* Repetition information */}
                                        {sets > 1 && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500"></span>
                                            <span className="text-gray-600 dark:text-gray-400">
                                              Repeat <span className="font-medium">{sets}x</span>
                                              {restBetweenSets > 0 && (
                                                <span> (<span className="font-medium">{formatTimeCircuit(restBetweenSets)}</span> rest between)</span>
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  case 'stations_round':
                                    const stationWorkTime = roundTemplate?.template?.workDuration || 0;
                                    const stationRestTime = roundTemplate?.template?.restDuration || 0;
                                    const stationSets = roundTemplate?.template?.repeatTimes || 1;
                                    const stationRestBetween = roundTemplate?.template?.restBetweenSets || 0;
                                    const formatTimeStations = (seconds) => {
                                      if (seconds >= 60) {
                                        const mins = Math.floor(seconds / 60);
                                        const secs = seconds % 60;
                                        if (secs === 0) {
                                          return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
                                        } else {
                                          return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ${secs} ${secs === 1 ? 'second' : 'seconds'}`;
                                        }
                                      }
                                      return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
                                    };
                                    
                                    return (
                                      <div className="space-y-1.5">
                                        {/* Primary timing information */}
                                        <div className="flex items-center gap-4 text-sm">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-gray-100">Work:</span>
                                            <span className="text-gray-600 dark:text-gray-400">{formatTimeStations(stationWorkTime)}</span>
                                          </div>
                                          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-gray-100">Rest:</span>
                                            <span className="text-gray-600 dark:text-gray-400">{formatTimeStations(stationRestTime)}</span>
                                          </div>
                                        </div>
                                        
                                        {/* Repetition information */}
                                        {stationSets > 1 && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500"></span>
                                            <span className="text-gray-600 dark:text-gray-400">
                                              Repeat <span className="font-medium">{stationSets}x</span>
                                              {stationRestBetween > 0 && (
                                                <span> (<span className="font-medium">{formatTimeStations(stationRestBetween)}</span> rest between)</span>
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  default:
                                    return <div className="text-sm text-gray-600 dark:text-gray-400">Unknown round format</div>;
                                }
                              })()}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                
                
                <div className="space-y-2">
                  {round.exercises.map((exercise, idx) => {
                    const isEditing = editingExerciseId === exercise.id;
                    return (
                      <div key={exercise.id} className="relative">
                        {idx > 0 && round.roundType === 'stations_round' && (
                          <div className="border-t border-gray-200 dark:border-gray-700 -mx-6 mb-4"></div>
                        )}
                        {round.roundType === 'stations_round' ? (
                          // Compact station layout - unified with circuit rounds
                          <div className="space-y-0">
                            {/* Station header - clean separator */}
                            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-white dark:bg-gray-800">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Station {idx + 1}
                                    </span>
                                    {(() => {
                                      // Check if this station has circuit configuration
                                      const roundNumber = parseInt(round.roundName.match(/\d+/)?.[0] || '1');
                                      const roundTemplate = circuitConfig?.config?.roundTemplates?.find(
                                        rt => rt.roundNumber === roundNumber
                                      );
                                      const stationCircuitConfig = roundTemplate?.template?.type === 'stations_round' 
                                        ? roundTemplate.template.stationCircuits?.[idx.toString()]
                                        : null;
                                      
                                      if (stationCircuitConfig) {
                                        return (
                                          <div className="flex items-center gap-1">
                                            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
                                            <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs font-medium flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                              </svg>
                                              <span>
                                                {stationCircuitConfig.workDuration}s/{stationCircuitConfig.restDuration}s × {stationCircuitConfig.sets}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        return null;
                                      }
                                    })()}
                                  </div>
                                </div>
                                {!isEditing && (
                                  <button
                                    onClick={() => {
                                      setSelectedItemForOptions({
                                        type: 'station',
                                        id: `${round.roundName}-${idx}`,
                                        name: `Station ${idx + 1}`,
                                        roundName: round.roundName,
                                        stationIndex: idx,
                                      });
                                      setShowOptionsDrawer(true);
                                    }}
                                    className="p-1.5 sm:p-2 rounded-md sm:rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                                    aria-label="Station options"
                                  >
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      className="text-gray-600 dark:text-gray-400 sm:w-[18px] sm:h-[18px]"
                                    >
                                      <circle cx="12" cy="5" r="1" />
                                      <circle cx="12" cy="12" r="1" />
                                      <circle cx="12" cy="19" r="1" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Exercises list - Minimalistic design */}
                            <div>
                              {/* Primary exercise */}
                              <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white dark:bg-gray-800">
                                <div className="flex items-start gap-1 sm:gap-4 min-w-0 w-full">
                                  <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 pt-1">
                                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center text-xs font-medium">
                                      1
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0 mx-1 sm:mx-0">
                                    <div className="flex flex-col gap-1 sm:gap-2">
                                      <span className="font-normal text-gray-900 dark:text-gray-100 text-base sm:text-lg break-words">{exercise.exerciseName}</span>
                                      {exercise.repsPlanned && (
                                        <span className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-semibold whitespace-nowrap self-start shadow-sm">
                                          {exercise.repsPlanned} {exercise.repsPlanned === 1 ? 'rep' : 'reps'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center flex-shrink-0">
                                    <button
                                      onClick={() => {
                                        setSelectedItemForOptions({
                                          type: 'exercise',
                                          id: exercise.id,
                                          name: exercise.exerciseName,
                                          exerciseId: exercise.exerciseId,
                                          roundName: round.roundName,
                                          repsPlanned: exercise.repsPlanned,
                                        });
                                        setShowOptionsDrawer(true);
                                      }}
                                      className="p-1.5 sm:p-2 rounded-md sm:rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                                      aria-label="Exercise options"
                                    >
                                      <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="text-gray-600 dark:text-gray-400 sm:w-[18px] sm:h-[18px]"
                                      >
                                        <circle cx="12" cy="5" r="1" />
                                        <circle cx="12" cy="12" r="1" />
                                        <circle cx="12" cy="19" r="1" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Additional exercises */}
                              {exercise.stationExercises?.map((stationEx, stationIdx) => (
                                <div key={stationEx.id} className="px-3 sm:px-6 py-3 sm:py-4 bg-white dark:bg-gray-800">
                                  <div className="flex items-start gap-1 sm:gap-4 min-w-0 w-full">
                                    <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 pt-1">
                                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center text-xs font-medium">
                                        {stationIdx + 2}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0 mx-1 sm:mx-0">
                                      <div className="flex flex-col gap-1 sm:gap-2">
                                        <span className="font-normal text-gray-900 dark:text-gray-100 text-base sm:text-lg break-words">{stationEx.exerciseName}</span>
                                        {stationEx.repsPlanned && (
                                          <span className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-semibold whitespace-nowrap self-start shadow-sm">
                                            {stationEx.repsPlanned} {stationEx.repsPlanned === 1 ? 'rep' : 'reps'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center flex-shrink-0">
                                      <button
                                        onClick={() => {
                                          setSelectedItemForOptions({
                                            type: 'exercise',
                                            id: stationEx.id,
                                            name: stationEx.exerciseName,
                                            exerciseId: stationEx.exerciseId,
                                            roundName: round.roundName,
                                            repsPlanned: stationEx.repsPlanned,
                                          });
                                          setShowOptionsDrawer(true);
                                        }}
                                        className="p-1.5 sm:p-2 rounded-md sm:rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                                        aria-label="Exercise options"
                                      >
                                        <svg
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          className="text-gray-600 dark:text-gray-400 sm:w-[18px] sm:h-[18px]"
                                        >
                                          <circle cx="12" cy="5" r="1" />
                                          <circle cx="12" cy="12" r="1" />
                                          <circle cx="12" cy="19" r="1" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Add Exercise button for this station */}
                            <div className="px-3 sm:px-6 py-3">
                              <button
                                onClick={() => {
                                  setAddExerciseModalConfig({
                                    roundName: round.roundName,
                                    roundData: round,
                                    targetStation: idx,
                                    mode: 'add-to-station'
                                  });
                                  setShowAddExerciseInDrawer(true);
                                  setShowOptionsDrawer(true);
                                }}
                                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 shadow-sm hover:shadow-md"
                              >
                                <div className="flex items-center justify-center gap-3 text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                  </div>
                                  <span className="font-medium">Add to Station {idx + 1}</span>
                                </div>
                              </button>
                            </div>
                            
                          </div>
                        ) : (
                          // Minimalistic single exercise layout for circuit rounds
                          <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                            <div className="flex items-start gap-1 sm:gap-4 min-w-0 w-full">
                              <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 pt-1">
                                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center text-xs font-medium">
                                  {idx + 1}
                                </span>
                                  {/* Reorder buttons - subtle positioning */}
                                  {!isEditing && (round.roundType !== 'circuit_round' && round.roundType !== 'amrap_round') && (
                                    <div className="flex flex-col gap-1">
                                      <button
                                        disabled={idx === 0 || reorderExerciseMutation.isPending}
                                        onClick={() => {
                                          toast.info(`Moving ${exercise.exerciseName} up...`);
                                          reorderExerciseMutation.mutate({
                                            sessionId: sessionId!,
                                            roundName: round.roundName,
                                            currentIndex: exercise.orderIndex,
                                            direction: "up",
                                          });
                                        }}
                                        className="h-8 w-8 p-0 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors focus:outline-none focus:ring-0"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto text-gray-400 dark:text-gray-500">
                                          <path d="M10.5 8.75L7 5.25L3.5 8.75" />
                                        </svg>
                                      </button>
                                      <button
                                        disabled={idx === round.exercises.length - 1 || reorderExerciseMutation.isPending}
                                        onClick={() => {
                                          reorderExerciseMutation.mutate({
                                            sessionId: sessionId!,
                                            roundName: round.roundName,
                                            currentIndex: exercise.orderIndex,
                                            direction: "down",
                                          });
                                        }}
                                        className="h-8 w-8 p-0 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors focus:outline-none focus:ring-0"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto text-gray-400 dark:text-gray-500">
                                          <path d="M3.5 5.25L7 8.75L10.5 5.25" />
                                        </svg>
                                      </button>
                                    </div>
                                  )}
                              </div>
                              <div className="flex-1 min-w-0 mx-1 sm:mx-0">
                                <div className="flex flex-col gap-1 sm:gap-2">
                                  <span className="font-normal text-gray-900 dark:text-gray-100 text-base sm:text-lg break-words">{exercise.exerciseName}</span>
                                  {exercise.repsPlanned && (
                                    <span className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-semibold whitespace-nowrap self-start shadow-sm">
                                      {exercise.repsPlanned} {exercise.repsPlanned === 1 ? 'rep' : 'reps'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center flex-shrink-0">
                                {!isEditing ? (
                                  <button
                                    onClick={() => {
                                      setSelectedItemForOptions({
                                        type: 'exercise',
                                        id: exercise.id,
                                        name: exercise.exerciseName,
                                        exerciseId: exercise.exerciseId,
                                        roundName: round.roundName,
                                        repsPlanned: exercise.repsPlanned,
                                        roundIndex: roundIndex,
                                        stationIndex: idx, // This represents exercise index in non-station rounds
                                      });
                                      setShowOptionsDrawer(true);
                                    }}
                                    className="p-1.5 sm:p-2 rounded-md sm:rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                                    aria-label="Exercise options"
                                  >
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      className="text-gray-600 dark:text-gray-400 sm:w-[18px] sm:h-[18px]"
                                    >
                                      <circle cx="12" cy="5" r="1" />
                                      <circle cx="12" cy="12" r="1" />
                                      <circle cx="12" cy="19" r="1" />
                                    </svg>
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Moved to modal below */}
                      </div>
                    );
                  })}
                  
                </div>
                
                
                {/* Spotify Music Section - Expandable */}
                {roundMusic && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedSpotifyRounds);
                        if (newExpanded.has(round.roundName)) {
                          newExpanded.delete(round.roundName);
                        } else {
                          newExpanded.add(round.roundName);
                        }
                        setExpandedSpotifyRounds(newExpanded);
                      }}
                      className="w-full p-4 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors text-left focus:outline-none focus:ring-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                          </svg>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Spotify Music</span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${
                            expandedSpotifyRounds.has(round.roundName) ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    
                    {/* Expanded content */}
                    {expandedSpotifyRounds.has(round.roundName) && (
                      <div className="mt-2 space-y-2 pl-4">
                        {/* HYPE Track */}
                        {roundMusic.track1 && (
                          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">HYPE</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">Starts at countdown</span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{roundMusic.track1.trackName}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-400 dark:text-gray-500">{track1Minutes}:{track1Seconds.toString().padStart(2, '0')}</div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* BRIDGE Track */}
                        {roundMusic.track2 && (
                          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">BRIDGE</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">Exercise 2</span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{roundMusic.track2.trackName}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* REST Track */}
                        {roundMusic.track3 && (
                          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">REST</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">Round end</span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{roundMusic.track3.trackName}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Add Exercise button for circuit and amrap rounds */}
                {(round.roundType === 'circuit_round' || round.roundType === 'amrap_round') && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setAddExerciseModalConfig({
                          roundName: round.roundName,
                          roundData: round,
                          targetStation: 0,
                          mode: 'add-to-round'
                        });
                        setShowAddExerciseInDrawer(true);
                        setShowOptionsDrawer(true);
                      }}
                      className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-center gap-3 text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <span className="font-medium">Add Exercise</span>
                      </div>
                    </button>
                  </div>
                )}
                
                {/* Add Station button for stations rounds */}
                {round.roundType === 'stations_round' && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        // Calculate the next station index (number of unique orderIndex values)
                        const uniqueStations = new Set(round.exercises.map(ex => ex.orderIndex));
                        const nextStationIndex = uniqueStations.size;
                        
                        console.log('[AddStation] Button clicked:', {
                          roundName: round.roundName,
                          currentStations: uniqueStations.size,
                          nextStationIndex,
                          uniqueOrderIndexes: Array.from(uniqueStations).sort((a, b) => a - b),
                          // Enhanced debugging for station structure
                          stationDetails: (() => {
                            const stationGroups: Record<number, any[]> = {};
                            round.exercises.forEach(ex => {
                              if (!stationGroups[ex.orderIndex]) {
                                stationGroups[ex.orderIndex] = [];
                              }
                              stationGroups[ex.orderIndex].push({
                                exerciseName: ex.exerciseName,
                                stationIndex: ex.stationExercises?.length > 0 ? 
                                  'has_sub_exercises' : 'main_exercise',
                                subExerciseCount: ex.stationExercises?.length || 0
                              });
                            });
                            return stationGroups;
                          })()
                        });
                        
                        setAddExerciseModalConfig({
                          roundName: round.roundName,
                          roundData: round,
                          targetStation: nextStationIndex,
                          mode: 'create-station'
                        });
                        setShowAddExerciseInDrawer(true);
                        setShowOptionsDrawer(true);
                      }}
                      className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-center gap-3 text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <span className="font-medium">Add Station</span>
                      </div>
                    </button>
                  </div>
                )}
                </div>
              </Card>
            )})
            }
            
            {/* Add Round Button */}
            <div className="flex justify-center mb-8">
              <button
                onClick={() => {
                  setAddRoundDrawerEditMode(null); // Reset edit mode for add operation
                  setShowAddRoundInDrawer(true);
                  setShowOptionsDrawer(true);
                }}
                className="w-[65%] p-4 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 shadow-sm hover:shadow-md rounded-lg flex flex-col items-center justify-center space-y-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-0"
              >
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-800 dark:hover:text-gray-50 transition-colors">
                    Add Round
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Create a new round with exercises
                  </p>
                </div>
              </button>
            </div>
            </div>
          </>
        ) : (
          // Empty state - Bold & Action-Focused
          <div className="flex flex-col items-center justify-center min-h-[65vh] px-6 py-12">
            {/* Large, impactful button first - no distractions */}
            <button
              onClick={() => {
                setAddRoundDrawerEditMode(null);
                setShowAddRoundInDrawer(true);
                setShowOptionsDrawer(true);
              }}
              className="group relative bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 rounded-3xl p-8 w-full max-w-xs shadow-sm hover:shadow-xl transition-all duration-300 active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/20"
            >
              {/* Animated plus icon */}
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg group-hover:shadow-purple-500/25">
                <svg className="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                  Add Round
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                  Tap to get started
                </p>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </button>

          </div>
        )}

          </WorkoutTab>
        ) : (
          <LightingTab 
            circuitConfig={circuitConfig as any}
            roundsData={roundsData as any}
            onConfigureLight={({ roundId, phaseType }) => {
              setSelectedLightForConfig({ 
                roundId, 
                phaseType, 
                phaseLabel: phaseType === 'work' ? 'WORK' : phaseType === 'rest' ? 'REST' : phaseType.toUpperCase(),
                currentConfig: null 
              });
              setShowLightingConfigInDrawer(true);
              setShowOptionsDrawer(true);
            }}
          />
        )}
        </div>
      </div>

      {/* Inline Exercise Replacement Modal */}
      {editingExerciseId && (() => {
        // First check if it's a main exercise
        let editingExercise = roundsData.flatMap(r => r.exercises).find(ex => ex.id === editingExerciseId);
        let editingRound = roundsData.find(r => r.exercises.some(ex => ex.id === editingExerciseId));
        let exerciseIndex = editingRound?.exercises.findIndex(ex => ex.id === editingExerciseId) ?? 0;
        
        // If not found in main exercises, check in stationExercises
        if (!editingExercise) {
          for (const round of roundsData) {
            for (let i = 0; i < round.exercises.length; i++) {
              const exercise = round.exercises[i];
              const stationEx = exercise.stationExercises?.find(se => se.id === editingExerciseId);
              if (stationEx) {
                editingExercise = stationEx;
                editingRound = round;
                exerciseIndex = i;
                break;
              }
            }
            if (editingExercise) break;
          }
        }
        
        return (
          <>
            {/* Background overlay */}
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => {
                setEditingExerciseId(null);
                setInlineSearchQuery("");
                setInlineSelectedId(null);
                setSelectedCategory(null);
                setCategoryMode('choice');
              }}
            />

            {/* Modal - Full Screen on Mobile */}
            <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
              {/* Header */}
              <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      Replace Exercise
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {editingExercise?.exerciseName}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingExerciseId(null);
                      setInlineSearchQuery("");
                      setInlineSelectedId(null);
                      setSelectedCategory(null);
                      setCategoryMode('choice');
                    }}
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
                              setEditingExerciseId(null);
                              setInlineSearchQuery("");
                              setInlineSelectedId(null);
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
                        onClick={() => {
                          if ((inlineSelectedId || inlineSearchQuery.trim()) && editingExercise && editingRound) {
                            
                            // Use the utility function for cleaner logic
                            replaceExercise({
                              exercise: editingExercise,
                              newExerciseId: inlineSelectedId || null,
                              customName: inlineSelectedId ? undefined : inlineSearchQuery.trim(),
                              round: editingRound,
                              sessionId: sessionId!,
                              userId: dummyUserId || "unknown",
                              circuitConfig,
                              mutations: {
                                swapSpecific: swapSpecificExerciseMutation,
                                swapCircuit: swapExerciseMutation
                              }
                            }).catch((error) => {
                              console.error('[Inline Replace] Error:', error);
                            });
                          }
                        }}
                        disabled={(!inlineSelectedId && !inlineSearchQuery.trim()) || swapExerciseMutation.isPending || swapSpecificExerciseMutation.isPending}
                        className={`h-12 px-10 text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-0 ${
                          (inlineSelectedId || inlineSearchQuery.trim()) && !swapExerciseMutation.isPending && !swapSpecificExerciseMutation.isPending
                            ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-md' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {(swapExerciseMutation.isPending || swapSpecificExerciseMutation.isPending) ? (
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
                    const isReplacingWarmup = editingRound?.roundName === 'Warm-up';
                    
                    
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
                      const beforeSearch = filtered.length;
                      filtered = filterExercisesBySearch(filtered, inlineSearchQuery);
                    } else if (selectedCategory) {
                      // Only apply category filter if there's no search query
                      const beforeCategory = filtered.length;
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
                    onClick={() => {
                      setEditingExerciseId(null);
                      setInlineSearchQuery("");
                      setInlineSelectedId(null);
                      setSelectedCategory(null);
                      setCategoryMode('choice');
                    }}
                    className="px-8 py-4 text-lg font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-all focus:outline-none focus:ring-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Mirror Update Confirmation Modal */}
      {showMirrorConfirm && pendingMirrorSwap && (
        <>
          {/* Background overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowMirrorConfirm(false)}
          />

          {/* Modal - Full Screen on Mobile */}
          <div className="fixed inset-0 z-50 flex flex-col">
            <Card className="flex-1 m-0 rounded-none shadow-none border-0 bg-white dark:bg-gray-800 p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Update Mirror Round?
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      This exercise also appears in <span className="font-semibold text-purple-600 dark:text-purple-400">{mirrorRoundName}</span> (repeat round).
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Would you like to update both rounds?
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // Update only the original
                      const originalRound = roundsData.find(r => r.roundName === pendingMirrorSwap.originalRound);
                      if (!originalRound) return;
                      
                      try {
                        await replaceExercise({
                          exercise: pendingMirrorSwap.selectedExercise,
                          newExerciseId: pendingMirrorSwap.selectedReplacement,
                          round: originalRound,
                          sessionId: sessionId!,
                          userId: dummyUserId || "unknown",
                          circuitConfig,
                          mutations: {
                            swapSpecific: swapSpecificExerciseMutation,
                            swapCircuit: swapExerciseMutation
                          }
                        });
                      } catch (error) {
                        console.error("Failed to swap exercise:", error);
                      }
                      setShowMirrorConfirm(false);
                      setPendingMirrorSwap(null);
                    }}
                  >
                    Update {pendingMirrorSwap.originalRound} Only
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={async () => {
                      // Update both rounds
                      const originalRound = roundsData.find(r => r.roundName === pendingMirrorSwap.originalRound);
                      const mirrorRound = roundsData.find(r => r.roundName === pendingMirrorSwap.mirrorRound);
                      if (!originalRound || !mirrorRound) return;
                      
                      try {
                        // Update original
                        await replaceExercise({
                          exercise: pendingMirrorSwap.selectedExercise,
                          newExerciseId: pendingMirrorSwap.selectedReplacement,
                          round: originalRound,
                          sessionId: sessionId!,
                          userId: dummyUserId || "unknown",
                          circuitConfig,
                          mutations: {
                            swapSpecific: swapSpecificExerciseMutation,
                            swapCircuit: swapExerciseMutation
                          }
                        });
                        
                        // Update mirror
                        await replaceExercise({
                          exercise: pendingMirrorSwap.mirrorExercise,
                          newExerciseId: pendingMirrorSwap.selectedReplacement,
                          round: mirrorRound,
                          sessionId: sessionId!,
                          userId: dummyUserId || "unknown",
                          circuitConfig,
                          mutations: {
                            swapSpecific: swapSpecificExerciseMutation,
                            swapCircuit: swapExerciseMutation
                          }
                        });
                      } catch (error) {
                        console.error("Failed to swap exercises:", error);
                      }
                      setShowMirrorConfirm(false);
                      setPendingMirrorSwap(null);
                    }}
                  >
                    Update Both Rounds
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Unified Options Drawer */}
      <OptionsDrawer
        isOpen={showOptionsDrawer}
        fullScreen={false}
        onClose={() => {
          setShowOptionsDrawer(false);
          setSelectedItemForOptions(null);
          setShowRepsInDrawer(false);
          setShowReplaceInDrawer(false);
          setShowAddExerciseInDrawer(false);
          setShowAddRoundInDrawer(false);
          setShowLightingConfigInDrawer(false);
          setSelectedLightForConfig(null);
        }}
        title={
          showRepsInDrawer 
            ? "Configure Exercise"
            : showReplaceInDrawer
            ? "Replace Exercise"
            : showAddExerciseInDrawer
            ? addExerciseModalConfig?.mode === 'add-to-station' 
              ? `Add Exercise to Station ${(addExerciseModalConfig?.targetStation || 0) + 1}`
              : addExerciseModalConfig?.mode === 'create-station'
              ? `Create Station ${(addExerciseModalConfig?.targetStation || 0) + 1}`
              : `Add Exercise to ${addExerciseModalConfig?.roundName || 'Round'}`
            : showLightingConfigInDrawer
            ? "Configure Light"
            : showAddRoundInDrawer
            ? (addRoundDrawerEditMode ? `Edit ${selectedItemForOptions?.name || 'Round'}` : "Add New Round")
            : selectedItemForOptions?.type === 'round' 
            ? selectedItemForOptions.name 
            : selectedItemForOptions?.type === 'station'
            ? selectedItemForOptions.name
            : selectedItemForOptions?.name || "Options"
        }
        customContent={
          (() => {
            
            if (showRepsInDrawer && selectedExerciseForSets) {
              return (
            <RepsConfiguration
              exerciseName={selectedExerciseForSets.exerciseName}
              exerciseId={selectedExerciseForSets.exerciseId}
              initialReps={repsValue}
              onSave={(newReps) => {
                updateRepsPlannedMutation.mutate({
                  sessionId: sessionId || "",
                  clientId: dummyUserId || "",
                  exerciseId: selectedExerciseForSets.id,
                  repsPlanned: newReps > 0 ? newReps : null,
                });
                setShowRepsInDrawer(false);
                setShowOptionsDrawer(false);
                setSelectedExerciseForSets(null);
              }}
              onBack={() => {
                setShowRepsInDrawer(false);
                setSelectedExerciseForSets(null);
              }}
              onClose={() => {
                setShowRepsInDrawer(false);
                setShowOptionsDrawer(false);
                setSelectedExerciseForSets(null);
              }}
              isSaving={updateRepsPlannedMutation.isPending}
            />
              );
            } else if (showAddExerciseInDrawer && addExerciseModalConfig) {
              return (
            <AddExerciseDrawer
              isOpen={showAddExerciseInDrawer}
              onClose={() => {
                setShowAddExerciseInDrawer(false);
                setShowOptionsDrawer(false);
                setAddExerciseModalConfig(null);
              }}
              mode={addExerciseModalConfig.mode}
              roundData={addExerciseModalConfig.roundData}
              roundName={addExerciseModalConfig.roundName}
              targetStation={addExerciseModalConfig.targetStation}
              availableExercises={availableExercisesRef.current}
              mutations={{
                addToStation: addExerciseToStationMutation,
                addToRound: addExerciseToRoundMutation,
              }}
              sessionId={sessionId || ""}
              userId={dummyUserId || ""}
            />
              );
            } else if (showReplaceInDrawer && selectedExerciseForReplace) {
              return (
            <ExerciseReplacement
              exercise={(() => {
                // Find the actual exercise from roundsData to get complete data including stationExercises
                const round = roundsData.find(r => r.roundName === selectedExerciseForReplace.roundName);
                if (round) {
                  const exercise = round.exercises.find(ex => ex.id === selectedExerciseForReplace.id);
                  if (exercise) {
                    return exercise;
                  }
                }
                return {
                  id: selectedExerciseForReplace.id,
                  exerciseName: selectedExerciseForReplace.exerciseName,
                  exerciseId: selectedExerciseForReplace.exerciseId,
                  orderIndex: selectedExerciseForReplace.orderIndex,
                };
              })()}
              round={roundsData.find(r => r.roundName === selectedExerciseForReplace.roundName)!}
              exerciseIndex={selectedExerciseForReplace.orderIndex}
              availableExercises={availableExercisesRef.current}
              sessionId={sessionId || ""}
              userId={dummyUserId || ""}
              circuitConfig={circuitConfig}
              mutations={{
                swapSpecific: swapSpecificExerciseMutation,
                swapCircuit: swapExerciseMutation,
              }}
              onCancel={() => {
                setShowReplaceInDrawer(false);
                setShowOptionsDrawer(false);
                setSelectedExerciseForReplace(null);
              }}
              onBack={() => {
                setShowReplaceInDrawer(false);
                setSelectedExerciseForReplace(null);
              }}
              onReplace={() => {
                setShowReplaceInDrawer(false);
                setShowOptionsDrawer(false);
                setSelectedExerciseForReplace(null);
              }}
            />
              );
            } else if (showAddRoundInDrawer) {
              return (
            <AddRoundDrawer
              isOpen={showAddRoundInDrawer}
              onClose={() => {
                setShowAddRoundInDrawer(false);
                setAddRoundDrawerEditMode(null); // Reset edit mode when closing
                setShowOptionsDrawer(false);
              }}
              onAdd={(config) => {
                // Map 'sets' to 'repeatTimes' for backend compatibility
                const { sets, ...restConfig } = config;
                const roundConfig = {
                  ...restConfig,
                  repeatTimes: sets
                };
                
                console.log("[AddRound] Creating round with config:", config);
                console.log("[AddRound] Round type:", config.type);
                console.log("[AddRound] Mapped roundConfig being sent:", roundConfig);
                console.log("[AddRound DEBUG] Timing values from config:", {
                  workDuration: config.workDuration,
                  restDuration: config.restDuration,
                  sets: config.sets,
                  restBetweenSets: config.restBetweenSets,
                  exercisesPerRound: config.exercisesPerRound
                });
                console.log("[AddRound DEBUG] Timing values in roundConfig:", {
                  workDuration: roundConfig.workDuration,
                  restDuration: roundConfig.restDuration,
                  repeatTimes: roundConfig.repeatTimes,
                  restBetweenSets: roundConfig.restBetweenSets,
                  exercisesPerRound: roundConfig.exercisesPerRound
                });
                
                addRoundMutation.mutate({
                  sessionId: sessionId!,
                  roundConfig,
                });
              }}
              isAdding={addRoundDrawerEditMode ? updateRoundMutation.isPending : addRoundMutation.isPending}
              editMode={addRoundDrawerEditMode || undefined}
            />
              );
            } else if (showLightingConfigInDrawer && selectedLightForConfig) {
              return (
                <LightingConfigDrawer
                  roundId={selectedLightForConfig.roundId}
                  phaseType={selectedLightForConfig.phaseType}
                  phaseLabel={selectedLightForConfig.phaseType === 'work' ? 'WORK' : 'REST'}
                  onSave={() => {
                    // TODO: Implement lighting configuration save logic
                    setShowLightingConfigInDrawer(false);
                    setShowOptionsDrawer(false);
                    setSelectedLightForConfig(null);
                  }}
                  onClose={() => {
                    setShowLightingConfigInDrawer(false);
                    setShowOptionsDrawer(false);
                    setSelectedLightForConfig(null);
                  }}
                />
              );
            } else {
              return undefined;
            }
          })()
        }
        items={
          showRepsInDrawer || showReplaceInDrawer || showLightingConfigInDrawer ? undefined :
          selectedItemForOptions?.type === 'round' 
            ? [
                {
                  id: "settings",
                  label: "Edit Round",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ),
                  onClick: () => {
                    console.log("[Round Settings] Click handler triggered");
                    console.log("[Round Settings] selectedItemForOptions:", selectedItemForOptions);
                    
                    const round = roundsData.find(r => r.roundName === selectedItemForOptions?.name);
                    console.log("[Round Settings] Found round:", round);
                    console.log("[Round Settings] circuitConfig exists:", !!circuitConfig);
                    
                    if (round && circuitConfig) {
                      // Extract round number from round name (e.g., "Round 1" -> 1)
                      const roundNumber = parseInt(round.roundName.match(/\d+/)?.[0] || '1');
                      console.log("[Round Settings] Extracted roundNumber:", roundNumber);
                      
                      // Find the round template for this round
                      const roundTemplate = circuitConfig.config.roundTemplates?.find(
                        rt => rt.roundNumber === roundNumber
                      );
                      console.log("[Round Settings] Found roundTemplate:", roundTemplate);
                      
                      if (roundTemplate) {
                        // Prepare edit mode data for AddRoundDrawer
                        const editModeData = {
                          roundNumber,
                          roundData: {
                            type: roundTemplate.template.type,
                            exercisesPerRound: roundTemplate.template.exercisesPerRound,
                            workDuration: roundTemplate.template.workDuration,
                            restDuration: roundTemplate.template.restDuration,
                            repeatTimes: roundTemplate.template.repeatTimes,
                            restBetweenSets: roundTemplate.template.restBetweenSets,
                            totalDuration: roundTemplate.template.totalDuration,
                          },
                          onSave: (config: any) => {
                            // Convert frontend config to backend format
                            const { sets, ...restConfig } = config;
                            const roundConfig = {
                              ...restConfig,
                              repeatTimes: sets || config.repeatTimes || 1, // Frontend uses 'sets', backend uses 'repeatTimes'
                            };

                            // Find current round templates
                            const currentRoundTemplates = circuitConfig.config.roundTemplates || [];
                            
                            // Update the specific round template
                            const updatedRoundTemplates = currentRoundTemplates.map(rt => {
                              if (rt.roundNumber === roundNumber) {
                                return {
                                  ...rt,
                                  template: {
                                    ...rt.template,
                                    ...roundConfig,
                                  }
                                };
                              }
                              return rt;
                            });

                            // Call the update mutation
                            updateRoundMutation.mutate({
                              sessionId: sessionId!,
                              config: {
                                ...circuitConfig.config,
                                roundTemplates: updatedRoundTemplates,
                              }
                            });
                          }
                        };

                        console.log("[Round Settings] Prepared editModeData:", editModeData);
                        
                        // Reset other drawer states first to ensure proper conditional rendering
                        setShowRepsInDrawer(false);
                        setShowReplaceInDrawer(false);
                        setShowAddExerciseInDrawer(false);
                        
                        // Open AddRoundDrawer in edit mode
                        console.log("[Round Settings] Setting edit mode and opening drawer");
                        setAddRoundDrawerEditMode(editModeData);
                        setShowAddRoundInDrawer(true);
                        console.log("[Round Settings] Drawer should be opening now");
                        
                        // Debug: Check state immediately after setting
                        setTimeout(() => {
                          console.log("[Round Settings] State check after timeout:", {
                            showAddRoundInDrawer,
                            addRoundDrawerEditMode: !!addRoundDrawerEditMode
                          });
                        }, 0);
                      } else {
                        console.log("[Round Settings] ERROR: No roundTemplate found for roundNumber:", roundNumber);
                      }
                    } else {
                      console.log("[Round Settings] ERROR: Missing round or circuitConfig", { round: !!round, circuitConfig: !!circuitConfig });
                    }
                  },
                  preventAutoClose: true, // Prevent auto-closing when transitioning to AddRoundDrawer
                },
                {
                  id: "delete-round",
                  label: "Delete Round",
                  variant: "danger" as const,
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  ),
                  onClick: () => {
                    const roundNumber = parseInt(selectedItemForOptions?.name.match(/\d+/)?.[0] || '0');
                    if (roundNumber > 0) {
                      setDeleteRoundData({
                        roundNumber: roundNumber,
                        name: selectedItemForOptions?.name || '',
                      });
                      setShowDeleteRoundConfirm(true);
                      setShowOptionsDrawer(false);
                    }
                  },
                },
                {
                  id: "move-up",
                  label: movingRoundId === `round-${parseInt(selectedItemForOptions?.name.match(/\d+/)?.[0] || '0')}` && reorderRoundsMutation.isPending ? "Moving Up..." : "Move Up",
                  icon: movingRoundId === `round-${parseInt(selectedItemForOptions?.name.match(/\d+/)?.[0] || '0')}` && reorderRoundsMutation.isPending ? (
                    <SpinnerIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  ),
                  disabled: selectedItemForOptions?.roundIndex === 0 || reorderRoundsMutation.isPending,
                  onClick: () => {
                    const roundNumber = parseInt(selectedItemForOptions?.name.match(/\d+/)?.[0] || '0');
                    console.log('[Move Round Up] Starting move operation', {
                      roundNumber,
                      selectedItem: selectedItemForOptions,
                      movingRoundId,
                      isPending: reorderRoundsMutation.isPending
                    });
                    if (roundNumber > 0) {
                      toast.info(`Moving ${selectedItemForOptions?.name} up...`);
                      reorderRoundsMutation.mutate({
                        sessionId: sessionId!,
                        currentRoundNumber: roundNumber,
                        direction: "up",
                      });
                    }
                  },
                },
                {
                  id: "move-down",
                  label: movingRoundId === `round-${parseInt(selectedItemForOptions?.name.match(/\d+/)?.[0] || '0')}` && reorderRoundsMutation.isPending ? "Moving Down..." : "Move Down",
                  icon: movingRoundId === `round-${parseInt(selectedItemForOptions?.name.match(/\d+/)?.[0] || '0')}` && reorderRoundsMutation.isPending ? (
                    <SpinnerIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  ),
                  disabled: selectedItemForOptions?.roundIndex === roundsData.length - 1 || reorderRoundsMutation.isPending,
                  onClick: () => {
                    const roundNumber = parseInt(selectedItemForOptions?.name.match(/\d+/)?.[0] || '0');
                    console.log('[Move Round Down] Starting move operation', {
                      roundNumber,
                      selectedItem: selectedItemForOptions,
                      movingRoundId,
                      isPending: reorderRoundsMutation.isPending
                    });
                    if (roundNumber > 0) {
                      toast.info(`Moving ${selectedItemForOptions?.name} down...`);
                      reorderRoundsMutation.mutate({
                        sessionId: sessionId!,
                        currentRoundNumber: roundNumber,
                        direction: "down",
                      });
                    }
                  },
                },
              ]
            : selectedItemForOptions?.type === 'station'
            ? [
                {
                  id: "station-settings",
                  label: "Station Settings",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ),
                  onClick: () => {
                    if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined) {
                      const roundNumber = parseInt(selectedItemForOptions.roundName.match(/\d+/)?.[0] || '1');
                      const roundTemplate = circuitConfig?.config?.roundTemplates?.find(
                        rt => rt.roundNumber === roundNumber
                      );
                      const totalWorkDuration = roundTemplate?.template?.workDuration || 180;
                      
                      setSelectedStationForCircuit({
                        roundName: selectedItemForOptions.roundName,
                        stationIndex: selectedItemForOptions.stationIndex,
                        stationNumber: selectedItemForOptions.stationIndex + 1,
                        totalWorkDuration: totalWorkDuration
                      });
                      setShowStationCircuitModal(true);
                    }
                  },
                },
                {
                  id: "station-move-up",
                  label: "Move Up",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  ),
                  disabled: selectedItemForOptions?.stationIndex === 0 || reorderExerciseMutation.isPending,
                  onClick: () => {
                    if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined) {
                      const round = roundsData.find(r => r.roundName === selectedItemForOptions.roundName);
                      const exercise = round?.exercises[selectedItemForOptions.stationIndex];
                      if (exercise) {
                        toast.info(`Moving ${exercise.exerciseName} up...`);
                        reorderExerciseMutation.mutate({
                          sessionId: sessionId!,
                          roundName: selectedItemForOptions.roundName,
                          currentIndex: exercise.orderIndex,
                          direction: "up",
                        });
                      }
                    }
                  },
                },
                {
                  id: "station-move-down",
                  label: "Move Down",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  ),
                  disabled: selectedItemForOptions?.stationIndex === (roundsData.find(r => r.roundName === selectedItemForOptions?.roundName)?.exercises.length || 0) - 1 || reorderExerciseMutation.isPending,
                  onClick: () => {
                    if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined) {
                      const round = roundsData.find(r => r.roundName === selectedItemForOptions.roundName);
                      const exercise = round?.exercises[selectedItemForOptions.stationIndex];
                      if (exercise) {
                        toast.info(`Moving ${exercise.exerciseName} down...`);
                        reorderExerciseMutation.mutate({
                          sessionId: sessionId!,
                          roundName: selectedItemForOptions.roundName,
                          currentIndex: exercise.orderIndex,
                          direction: "down",
                        });
                      }
                    }
                  },
                },
              ]
            : selectedItemForOptions?.type === 'exercise'
            ? (() => {
                // Get the round data to check if this is a non-station round
                const round = roundsData.find(r => r.roundName === selectedItemForOptions?.roundName);
                const isNonStationRound = round && round.roundType !== 'stations_round';
                const exerciseCount = round?.exercises.length || 0;
                
                return [
                  {
                    id: "replace-exercise",
                    label: "Replace Exercise",
                    preventAutoClose: true,
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 4v6h6M23 20v-6h-6"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                      </svg>
                    ),
                    onClick: () => {
                      if (selectedItemForOptions) {
                        setSelectedExerciseForReplace({
                          id: selectedItemForOptions.id,
                          exerciseName: selectedItemForOptions.name,
                          exerciseId: selectedItemForOptions.exerciseId!,
                          roundName: selectedItemForOptions.roundName!,
                          orderIndex: selectedItemForOptions.roundIndex || 0,
                        });
                        setShowReplaceInDrawer(true);
                      }
                    },
                  },
                  {
                    id: "configure-reps",
                    label: "Configure Reps",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                    preventAutoClose: true,
                    onClick: () => {
                      if (selectedItemForOptions) {
                        setSelectedExerciseForSets({
                          id: selectedItemForOptions.id,
                          exerciseName: selectedItemForOptions.name,
                          exerciseId: selectedItemForOptions.exerciseId!,
                          roundName: selectedItemForOptions.roundName!,
                        });
                        setRepsValue(selectedItemForOptions.repsPlanned || 0);
                                setShowRepsInDrawer(true);
                      }
                    },
                  },
                  {
                    id: "delete-exercise",
                    label: "Delete Exercise",
                    variant: "danger" as const,
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    ),
                    onClick: () => {
                      if (selectedItemForOptions) {
                        setDeleteExerciseData({
                          id: selectedItemForOptions.id,
                          name: selectedItemForOptions.name,
                        });
                        setShowDeleteExerciseConfirm(true);
                        setShowOptionsDrawer(false);
                      }
                    },
                  },
                  // Add Move Up and Move Down for non-station exercises
                  ...(isNonStationRound ? [
                    {
                      id: "move-up",
                      label: (() => {
                        if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined && round) {
                          const exercise = round.exercises[selectedItemForOptions.stationIndex];
                          if (exercise && movingExerciseId === exercise.orderIndex.toString() && reorderExerciseMutation.isPending) {
                            return "Moving Up...";
                          }
                        }
                        return "Move Up";
                      })(),
                      icon: (() => {
                        if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined && round) {
                          const exercise = round.exercises[selectedItemForOptions.stationIndex];
                          if (exercise && movingExerciseId === exercise.orderIndex.toString() && reorderExerciseMutation.isPending) {
                            return <SpinnerIcon className="w-5 h-5 animate-spin" />;
                          }
                        }
                        return (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        );
                      })(),
                      disabled: selectedItemForOptions?.stationIndex === 0 || reorderExerciseMutation.isPending,
                      onClick: () => {
                        if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined && round) {
                          const exercise = round.exercises[selectedItemForOptions.stationIndex];
                          if (exercise) {
                            toast.info(`Moving ${exercise.exerciseName} up...`);
                            reorderExerciseMutation.mutate({
                              sessionId: sessionId!,
                              roundName: selectedItemForOptions.roundName,
                              currentIndex: exercise.orderIndex,
                              direction: "up",
                            });
                          }
                        }
                      },
                    },
                    {
                      id: "move-down",
                      label: (() => {
                        if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined && round) {
                          const exercise = round.exercises[selectedItemForOptions.stationIndex];
                          if (exercise && movingExerciseId === exercise.orderIndex.toString() && reorderExerciseMutation.isPending) {
                            return "Moving Down...";
                          }
                        }
                        return "Move Down";
                      })(),
                      icon: (() => {
                        if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined && round) {
                          const exercise = round.exercises[selectedItemForOptions.stationIndex];
                          if (exercise && movingExerciseId === exercise.orderIndex.toString() && reorderExerciseMutation.isPending) {
                            return <SpinnerIcon className="w-5 h-5 animate-spin" />;
                          }
                        }
                        return (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        );
                      })(),
                      disabled: selectedItemForOptions?.stationIndex === exerciseCount - 1 || reorderExerciseMutation.isPending,
                      onClick: () => {
                        if (selectedItemForOptions?.roundName && selectedItemForOptions?.stationIndex !== undefined && round) {
                          const exercise = round.exercises[selectedItemForOptions.stationIndex];
                          if (exercise) {
                            toast.info(`Moving ${exercise.exerciseName} down...`);
                            reorderExerciseMutation.mutate({
                              sessionId: sessionId!,
                              roundName: selectedItemForOptions.roundName,
                              currentIndex: exercise.orderIndex,
                              direction: "down",
                            });
                          }
                        }
                      },
                    },
                  ] : []),
                ];
              })()
            : []
        }
      />

      
      {/* DUPLICATE COMPONENT REMOVED - Using only the one inside OptionsDrawer to fix Chrome conflicts */}


      {/* Round Options Modal */}
      {showRoundOptionsModal && selectedRoundForOptions && circuitConfig && (
        <>
          {/* Background overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              setShowRoundOptionsModal(false);
              setSelectedRoundForOptions(null);
            }}
          />

          {/* Modal - Full Screen */}
          <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-800">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {selectedRoundForOptions.roundName} Settings
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Adjust timing and configuration for this round
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRoundOptionsModal(false);
                    setSelectedRoundForOptions(null);
                  }}
                  className="rounded-lg p-2 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-0"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <RoundEditContent
              round={selectedRoundForOptions}
              circuitConfig={circuitConfig}
              sessionId={sessionId!}
              onClose={() => {
                setShowRoundOptionsModal(false);
                setSelectedRoundForOptions(null);
              }}
              deleteRoundMutation={deleteRoundMutation}
            />
          </div>
        </>
      )}

      {/* Station Circuit Configuration Modal - Full Screen */}
      {showStationCircuitModal && selectedStationForCircuit && (
        <>
          {/* Background overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              setShowStationCircuitModal(false);
              setSelectedStationForCircuit(null);
            }}
          />

          {/* Modal - Full Screen */}
          <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-800">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Station {selectedStationForCircuit.stationNumber} Configuration
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Configure timer settings for this station ({selectedStationForCircuit.totalWorkDuration}s total)
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowStationCircuitModal(false);
                    setSelectedStationForCircuit(null);
                  }}
                  className="rounded-lg p-2 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-0"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <StationCircuitConfigContent
              stationInfo={selectedStationForCircuit}
              circuitConfig={circuitConfig}
              onClose={() => {
                setShowStationCircuitModal(false);
                setSelectedStationForCircuit(null);
              }}
              onSave={async (config) => {
                if (!selectedStationForCircuit || !circuitConfig) return;
                
                // Get current round template
                const roundNumber = parseInt(selectedStationForCircuit.roundName.match(/\d+/)?.[0] || '1');
                const currentRoundTemplates = circuitConfig.config.roundTemplates || [];
                
                // Update the round template with station circuit config
                const updatedRoundTemplates = currentRoundTemplates.map(rt => {
                  if (rt.roundNumber === roundNumber && rt.template.type === 'stations_round') {
                    const currentStationCircuits = rt.template.stationCircuits || {};
                    
                    if (config) {
                      // Add or update circuit config for this station
                      return {
                        ...rt,
                        template: {
                          ...rt.template,
                          stationCircuits: {
                            ...currentStationCircuits,
                            [selectedStationForCircuit.stationIndex]: config
                          }
                        }
                      };
                    } else {
                      // Remove circuit config for this station (AMRAP mode)
                      const { [selectedStationForCircuit.stationIndex]: removed, ...remainingCircuits } = currentStationCircuits;
                      return {
                        ...rt,
                        template: {
                          ...rt.template,
                          stationCircuits: Object.keys(remainingCircuits).length > 0 ? remainingCircuits : undefined
                        }
                      };
                    }
                  }
                  return rt;
                });
                
                // Save using the update config mutation
                try {
                  await updateStationConfigMutation.mutateAsync({
                    sessionId: sessionId!,
                    config: {
                      roundTemplates: updatedRoundTemplates
                    }
                  });
                  
                  setShowStationCircuitModal(false);
                  setSelectedStationForCircuit(null);
                } catch (error) {
                  console.error('Failed to update station circuit config:', error);
                }
              }}
            />
          </div>
        </>
      )}


      {/* Delete Exercise Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteExerciseConfirm}
        onClose={() => {
          setShowDeleteExerciseConfirm(false);
          setDeleteExerciseData(null);
        }}
        onConfirm={() => {
          if (deleteExerciseData) {
            toast.info(`Deleting ${deleteExerciseData.name}...`);
            deleteCircuitExerciseMutation.mutate({
              sessionId: sessionId || "",
              exerciseId: deleteExerciseData.id,
            });
            setShowDeleteExerciseConfirm(false);
            setDeleteExerciseData(null);
          }
        }}
        title="Delete Exercise"
        message={`Are you sure you want to delete "${deleteExerciseData?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteCircuitExerciseMutation.isPending}
        variant="danger"
      />

      {/* Delete Round Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteRoundConfirm}
        onClose={() => {
          setShowDeleteRoundConfirm(false);
          setDeleteRoundData(null);
        }}
        onConfirm={() => {
          if (deleteRoundData) {
            toast.info(`Deleting ${deleteRoundData.name}...`);
            deleteRoundMutation.mutate({
              sessionId: sessionId || "",
              roundNumber: deleteRoundData.roundNumber,
            });
            setShowDeleteRoundConfirm(false);
            setDeleteRoundData(null);
          }
        }}
        title="Delete Round"
        message={`Are you sure you want to delete "${deleteRoundData?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteRoundMutation.isPending}
        variant="danger"
      />

    </div>
  );
}


// Round Edit Content Component
function RoundEditContent({
  round,
  circuitConfig,
  sessionId,
  onClose,
  deleteRoundMutation
}: {
  round: RoundData;
  circuitConfig: CircuitConfig;
  sessionId: string;
  onClose: () => void;
  deleteRoundMutation: any;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  // Extract round number from round name (e.g., "Round 1" -> 1)
  const roundNumber = parseInt(round.roundName.match(/\d+/)?.[0] || '1');
  
  // Find the round template for this round
  const roundTemplate = circuitConfig.config.roundTemplates?.find(
    rt => rt.roundNumber === roundNumber
  );
  
  if (!roundTemplate) {
    return (
      <div className="flex-1 p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          Round configuration not found
        </div>
      </div>
    );
  }
  
  // Initialize state based on round type (using strings to avoid mobile input issues)
  const [workDuration, setWorkDuration] = useState(
    roundTemplate.template.type === 'amrap_round' 
      ? "0" 
      : String(roundTemplate.template.workDuration)
  );
  const [restDuration, setRestDuration] = useState(
    roundTemplate.template.type === 'amrap_round' 
      ? "0" 
      : String(roundTemplate.template.restDuration)
  );
  const [repeatTimes, setRepeatTimes] = useState(
    roundTemplate.template.type === 'amrap_round' 
      ? "0" 
      : String(roundTemplate.template.repeatTimes)
  );
  const [restBetweenSets, setRestBetweenSets] = useState(
    (roundTemplate.template.type === 'circuit_round' || roundTemplate.template.type === 'stations_round')
      ? String(roundTemplate.template.restBetweenSets || "30")
      : "30"
  );
  const [totalDuration, setTotalDuration] = useState(
    roundTemplate.template.type === 'amrap_round' 
      ? String(roundTemplate.template.totalDuration)
      : "0"
  );
  
  // Update mutation
  const updateConfigMutation = useMutation({
    ...trpc.circuitConfig.updatePublic.mutationOptions(),
    onSuccess: () => {
      toast.success("Round settings updated");
      
      // Invalidate circuit config query using TRPC query key format
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ 
          sessionId: sessionId || "" 
        }).queryKey,
      });
      
      // Also invalidate workout selections to trigger full UI refresh
      queryClient.invalidateQueries({
        queryKey: trpc.workoutSelections.getSelections.queryOptions({ 
          sessionId 
        }).queryKey,
      });
      
      // Invalidate session query as well since it contains templateConfig
      queryClient.invalidateQueries({
        queryKey: trpc.trainingSession.getSession.queryOptions({ 
          id: sessionId 
        }).queryKey,
      });
      
      onClose();
    },
    onError: (error: any) => {
      console.error("Update error:", error);
      
      // Check if it's a circuit timing validation error
      if (error?.message?.includes('circuit timing') && error?.message?.includes('must equal station duration')) {
        toast.error("Circuit timer conflicts with station duration. Remove circuit timer before updating station settings.");
      } else {
        toast.error("Failed to update round settings");
      }
    },
  });
  
  const handleSave = async () => {
    // Convert strings to numbers and validate
    const workDurationNum = parseInt(workDuration) || 0;
    const restDurationNum = parseInt(restDuration) || 0;
    const repeatTimesNum = parseInt(repeatTimes) || 1;
    const restBetweenSetsNum = parseInt(restBetweenSets) || 0;
    const totalDurationNum = parseInt(totalDuration) || 0;
    
    // Basic validation
    if (roundTemplate.template.type !== 'amrap_round') {
      // Work duration validation removed - allow any duration
      if (roundTemplate.template.type === 'stations_round') {
        if (restDurationNum < 5 || restDurationNum > 120) {
          toast.error("Rest duration must be between 5 and 120 seconds");
          return;
        }
      } else {
        if (restDurationNum < 0 || restDurationNum > 120) {
          toast.error("Rest duration must be between 0 and 120 seconds");
          return;
        }
      }
      if (repeatTimesNum < 1 || repeatTimesNum > 5) {
        toast.error("Number of sets must be between 1 and 5");
        return;
      }
      // Validate rest between sets for circuit and stations rounds with multiple sets
      if ((roundTemplate.template.type === 'circuit_round' || roundTemplate.template.type === 'stations_round') && repeatTimesNum > 1) {
        if (restBetweenSetsNum < 5 || restBetweenSetsNum > 300) {
          toast.error("Rest between sets must be between 5 and 300 seconds");
          return;
        }
      }
    } else {
      if (totalDurationNum < 60) {
        toast.error("Total duration must be at least 60 seconds");
        return;
      }
      // No maximum limit for AMRAP duration
    }
    
    // Create updated round templates array
    const updatedRoundTemplates = circuitConfig.config.roundTemplates.map(rt => {
      if (rt.roundNumber === roundNumber) {
        // Update this round based on its type
        if (roundTemplate.template.type === 'stations_round') {
          return {
            ...rt,
            template: {
              ...rt.template,
              workDuration: workDurationNum,
              restDuration: restDurationNum,
              repeatTimes: repeatTimesNum,
              restBetweenSets: repeatTimesNum > 1 ? Math.max(5, restBetweenSetsNum) : undefined,
            }
          };
        } else if (roundTemplate.template.type === 'circuit_round') {
          return {
            ...rt,
            template: {
              ...rt.template,
              workDuration: workDurationNum,
              restDuration: restDurationNum,
              repeatTimes: repeatTimesNum,
              restBetweenSets: repeatTimesNum > 1 ? Math.max(5, restBetweenSetsNum) : undefined,
            }
          };
        } else if (roundTemplate.template.type === 'amrap_round') {
          return {
            ...rt,
            template: {
              ...rt.template,
              totalDuration: totalDurationNum,
            }
          };
        }
      }
      return rt;
    });
    
    try {
      await updateConfigMutation.mutateAsync({
        sessionId,
        config: {
          roundTemplates: updatedRoundTemplates,
        },
      });
    } catch (error) {
      console.error('Failed to save round settings:', error);
    }
  };
  
  // World-class preset configurations for stations rounds
  const stationsWorkPresets = [
    { label: '30s', value: 30, description: 'Quick intervals' },
    { label: '45s', value: 45, description: 'Standard work' },
    { label: '60s', value: 60, description: 'Endurance focus' },
    { label: '90s', value: 90, description: 'Extended sets' },
    { label: '2m', value: 120, description: 'Long intervals' },
    { label: '3m', value: 180, description: 'Aerobic training' },
    { label: '4m', value: 240, description: 'Endurance base' },
    { label: '5m', value: 300, description: 'Max endurance' },
  ];

  const stationsRestPresets = [
    { label: '10s', value: 10, description: 'Active recovery' },
    { label: '15s', value: 15, description: 'Quick transition' },
    { label: '30s', value: 30, description: 'Standard rest' },
    { label: '45s', value: 45, description: 'Extended break' },
    { label: '60s', value: 60, description: 'Full recovery' },
    { label: '90s', value: 90, description: 'Complete rest' },
    { label: '2m', value: 120, description: 'Maximum rest' },
  ];
  
  return (
    <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Round Type Badge */}
          <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Round Type:</span>
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
            {roundTemplate.template.type === 'stations_round' && 'Stations'}
            {roundTemplate.template.type === 'circuit_round' && 'Circuit'}
            {roundTemplate.template.type === 'amrap_round' && 'AMRAP'}
          </span>
        </div>
        
        {/* Configuration Fields */}
        <div className="space-y-4">
          {/* Stations Round Config */}
          {roundTemplate.template.type === 'stations_round' && (
            <>
              <DurationInput
                label="Work Duration"
                value={parseInt(workDuration) || 240}
                onChange={(value) => setWorkDuration(value.toString())}
                presets={[]} // No preset buttons
                allowCustom={true}
              />

              {/* Circuit Timer Calculator - Hidden by default */}
              <CircuitTimerCalculator
                onApplyToWorkDuration={(calculatedSeconds) => {
                  setWorkDuration(calculatedSeconds.toString());
                }}
              />
              
              <DurationInput
                label="Rest Duration"
                value={parseInt(restDuration) || 60}
                onChange={(value) => setRestDuration(value.toString())}
                presets={[]} // No preset buttons
                allowCustom={true}
                min={5}
                max={120}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number of Sets
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  max={5}
                  value={repeatTimes}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setRepeatTimes(value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Min: 1, Max: 5
                </p>
              </div>
              
              {parseInt(repeatTimes) > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rest Between Sets (seconds)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={5}
                    max={300}
                    value={restBetweenSets}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setRestBetweenSets(value);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Min: 5s, Max: 5 minutes
                  </p>
                </div>
              )}
            </>
          )}
          
          {/* Circuit Round Config */}
          {roundTemplate.template.type === 'circuit_round' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Work Duration (seconds)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={10}
                  max={300}
                  value={workDuration}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setWorkDuration(value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Min: 10s, Max: 5 minutes
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rest Duration (seconds)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  max={120}
                  value={restDuration}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setRestDuration(value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Min: 0s, Max: 2 minutes
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number of Sets
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  max={5}
                  value={repeatTimes}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setRepeatTimes(value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Min: 1, Max: 5
                </p>
              </div>
              
              {parseInt(repeatTimes) > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rest Between Sets (seconds)
                  </label>
                  <input
                    type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                    min={5}
                    max={300}
                    value={restBetweenSets}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setRestBetweenSets(value);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Min: 5s, Max: 5 minutes
                  </p>
                </div>
              )}
            </>
          )}
          
          {/* AMRAP Round Config */}
          {roundTemplate.template.type === 'amrap_round' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Total Duration (seconds)
              </label>
              <input
                type="number"
                min={60}
                max={600}
                value={totalDuration}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setTotalDuration(value);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Min: 1 minute, Max: 10 minutes
              </p>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={updateConfigMutation.isPending}
              className="flex-1 h-12"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateConfigMutation.isPending}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateConfigMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
          </div>
        </div>
    </div>
  );
}

// Warm-up exercises component
function WarmupExercisesList({ 
  sessionId,
  onReplaceClick 
}: { 
  sessionId: string;
  onReplaceClick: (exercise: any, round: string, exerciseIndex: number) => void;
}) {
  const trpc = useTRPC();
  
  // Get saved selections (warm-up exercises will have groupName: "Warm-up")
  const { data: savedSelections, isLoading } = useQuery({
    ...trpc.workoutSelections.getSelections.queryOptions({ sessionId }),
    enabled: !!sessionId,
  });
  
  // Filter for warm-up exercises
  const warmupExercises = useMemo(() => {
    if (!savedSelections) return [];
    
    // Get all warm-up exercises (allow duplicates)
    return savedSelections
      .filter((selection: any) => selection.groupName === "Warm-up")
      .sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  }, [savedSelections]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-600 dark:text-gray-400" />
      </div>
    );
  }
  
  if (warmupExercises.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        No warm-up exercises selected yet
      </div>
    );
  }
  
  return (
    <>
      {warmupExercises.map((exercise, idx) => (
        <div key={exercise.id} className="flex items-center justify-between p-6 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 transition-all min-h-[72px] focus-within:outline-none focus-within:ring-0">
          <div className="flex items-center gap-6 flex-1">
            <span className="w-10 h-10 rounded-full bg-orange-500/20 dark:bg-amber-300/20 text-orange-700 dark:text-amber-200 ring-2 ring-orange-400/50 dark:ring-amber-300/40 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {idx + 1}
            </span>
            <span className="font-medium text-base leading-tight py-1 text-gray-900 dark:text-gray-100">{exercise.exerciseName}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Replace button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReplaceClick(exercise, "Warm-up", exercise.orderIndex)}
              className="h-8 px-3 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-0"
            >
              Replace
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}

// Station Circuit Configuration Component
function StationCircuitConfigContent({
  stationInfo,
  circuitConfig,
  onClose,
  onSave,
}: {
  stationInfo: {
    roundName: string;
    stationIndex: number;
    stationNumber: number;
    totalWorkDuration: number;
  };
  circuitConfig: any;
  onClose: () => void;
  onSave: (config: { workDuration: number; restDuration: number; sets: number } | null) => void;
}) {
  // Get existing configuration for this station
  const roundNumber = parseInt(stationInfo.roundName.match(/\d+/)?.[0] || '1');
  const roundTemplate = circuitConfig?.config?.roundTemplates?.find(
    rt => rt.roundNumber === roundNumber
  );
  const existingStationConfig = roundTemplate?.template?.type === 'stations_round' 
    ? roundTemplate.template.stationCircuits?.[stationInfo.stationIndex.toString()]
    : null;

  const [mode, setMode] = useState<'amrap' | 'circuit'>(existingStationConfig ? 'circuit' : 'amrap');
  const [workDuration, setWorkDuration] = useState(existingStationConfig?.workDuration?.toString() || "40");
  const [sets, setSets] = useState(existingStationConfig?.sets || 3);
  
  // Calculate rest duration automatically
  const calculateRestDuration = () => {
    if (mode === 'amrap') return 0;
    if (sets <= 1) return 0;
    
    const workDurationNum = parseInt(workDuration) || 0;
    const totalWorkTime = workDurationNum * sets;
    const totalRestTime = stationInfo.totalWorkDuration - totalWorkTime;
    const restDuration = Math.floor(totalRestTime / (sets - 1));
    
    return restDuration;
  };
  
  const restDuration = calculateRestDuration();
  
  // Calculate total time for validation
  const totalConfiguredTime = mode === 'circuit' 
    ? ((parseInt(workDuration) || 0) * sets) + (restDuration * (sets - 1))
    : 0;
  
  const isValidConfiguration = mode === 'amrap' || (
    restDuration >= 0 && 
    restDuration === calculateRestDuration() && 
    totalConfiguredTime === stationInfo.totalWorkDuration
  );
  
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-2xl mx-auto">
        {/* Mode Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Timer Mode</h3>
          <div className="flex gap-4">
            <button
              onClick={() => setMode('amrap')}
              className={cn(
                "flex-1 p-4 rounded-xl border-2 text-left transition-all",
                mode === 'amrap'
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  mode === 'amrap' ? "border-blue-500" : "border-gray-400 dark:border-gray-600"
                )}>
                  {mode === 'amrap' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">AMRAP</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    As Many Rounds As Possible for {stationInfo.totalWorkDuration}s
                  </p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setMode('circuit')}
              className={cn(
                "flex-1 p-4 rounded-xl border-2 text-left transition-all",
                mode === 'circuit'
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  mode === 'circuit' ? "border-blue-500" : "border-gray-400 dark:border-gray-600"
                )}>
                  {mode === 'circuit' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Circuit</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Structured intervals with work/rest periods
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
        
        {/* Circuit Configuration */}
        {mode === 'circuit' && (
          <div className="space-y-6">
            {/* Work Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Work Duration (seconds)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={workDuration}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setWorkDuration(value);
                }}
                placeholder="Enter work duration"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Sets Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Sets
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSets(num)}
                    className={cn(
                      "py-2 px-4 rounded-lg border transition-all",
                      sets === num
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Rest Duration (Auto-calculated) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rest Duration (auto-calculated)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={restDuration >= 0 ? `${restDuration}s` : 'Invalid'}
                  disabled
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg bg-gray-100 dark:bg-gray-900 cursor-not-allowed",
                    restDuration >= 0 
                      ? "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                      : "border-red-300 dark:border-red-600 text-red-600 dark:text-red-400"
                  )}
                />
              </div>
              {restDuration < 0 ? (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  Work time exceeds station duration. Try fewer sets or shorter work duration.
                </p>
              ) : restDuration !== calculateRestDuration() || totalConfiguredTime !== stationInfo.totalWorkDuration ? (
                <div className="mt-1 space-y-1">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Configuration timing: {totalConfiguredTime}s (need exactly {stationInfo.totalWorkDuration}s)
                  </p>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Try: {(() => {
                      const suggestions = [];
                      const currentWork = parseInt(workDuration) || 0;
                      const currentSets = sets;
                      
                      // Suggest work duration adjustments (±1-3 seconds)
                      for (let adjustment of [-3, -2, -1, 1, 2, 3]) {
                        const newWork = currentWork + adjustment;
                        if (newWork > 0 && newWork <= stationInfo.totalWorkDuration) {
                          const totalWork = newWork * currentSets;
                          const totalRest = stationInfo.totalWorkDuration - totalWork;
                          const newRest = Math.floor(totalRest / (currentSets - 1));
                          const calculatedTotal = (newWork * currentSets) + (newRest * (currentSets - 1));
                          
                          if (calculatedTotal === stationInfo.totalWorkDuration && newRest >= 0) {
                            suggestions.push(`${newWork}s work`);
                            break;
                          }
                        }
                      }
                      
                      // Suggest set count adjustments
                      for (let newSets of [currentSets - 1, currentSets + 1]) {
                        if (newSets >= 2 && newSets <= 6) {
                          const totalWork = currentWork * newSets;
                          const totalRest = stationInfo.totalWorkDuration - totalWork;
                          const newRest = Math.floor(totalRest / (newSets - 1));
                          const calculatedTotal = (currentWork * newSets) + (newRest * (newSets - 1));
                          
                          if (calculatedTotal === stationInfo.totalWorkDuration && newRest >= 0) {
                            suggestions.push(`${newSets} sets`);
                            break;
                          }
                        }
                      }
                      
                      return suggestions.length > 0 ? suggestions.join(' or ') : 'different values';
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
            
            {/* Summary */}
            {isValidConfiguration && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Configuration Summary</span>
                </div>
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                  {workDuration}s work / {restDuration}s rest × {sets} sets = {totalConfiguredTime}s total
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="mt-8 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (mode === 'amrap') {
                onSave(null);
              } else {
                onSave({ 
                  workDuration: parseInt(workDuration) || 0, 
                  restDuration, 
                  sets 
                });
              }
            }}
            disabled={mode === 'circuit' && !isValidConfiguration}
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === 'circuit' && !isValidConfiguration 
              ? 'Invalid Timing' 
              : 'Save Configuration'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CircuitWorkoutOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <CircuitWorkoutOverviewContent />
    </Suspense>
  );
}