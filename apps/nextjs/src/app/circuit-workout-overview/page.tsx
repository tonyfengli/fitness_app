"use client";

import React, { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  Button, 
  Loader2Icon as Loader2,
  ChevronLeftIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  useRealtimeExerciseSwaps,
  SearchIcon,
  SpinnerIcon,
  XIcon,
  filterExercisesBySearch,
  cn,
} from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";
import { api, useTRPC } from "~/trpc/react";

// Circuit timing utilities
function getEffectiveTrackDuration(trackDurationMs: number, hypeTimestamp?: number | null): number {
  if (!hypeTimestamp) {
    return trackDurationMs;
  }
  
  // Track starts 5 seconds before hype moment (matching backend logic)
  const offsetMs = Math.max(0, (hypeTimestamp - 5) * 1000);
  return trackDurationMs - offsetMs;
}

interface RoundTiming {
  roundNumber: number;
  countdownStartMs: number;
  workStartMs: number;
  endTimeMs: number;
  totalDurationMs: number;
}

interface CircuitTimingResult {
  rounds: RoundTiming[];
  totalWorkoutDurationMs: number;
  totalWorkTimeMs: number;
  totalRestTimeMs: number;
}

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
  }>;
  isRepeat?: boolean;
  roundType?: string;
}

// Group exercises by muscle
const groupByMuscle = (exercises: any[]) => {
  const grouped = exercises.reduce((acc, exercise) => {
    const muscle = exercise.primaryMuscle || "Other";
    if (!acc[muscle]) acc[muscle] = [];
    acc[muscle].push(exercise);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Sort by muscle name
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
};

// Badge colors for movement patterns
const MOVEMENT_PATTERN_COLORS: Record<string, string> = {
  horizontal_push: "bg-blue-100 text-blue-800",
  horizontal_pull: "bg-green-100 text-green-800",
  vertical_push: "bg-purple-100 text-purple-800",
  vertical_pull: "bg-indigo-100 text-indigo-800",
  squat: "bg-red-100 text-red-800",
  hinge: "bg-orange-100 text-orange-800",
  lunge: "bg-pink-100 text-pink-800",
  core: "bg-yellow-100 text-yellow-800",
  carry: "bg-teal-100 text-teal-800",
  isolation: "bg-gray-100 text-gray-800",
};

function CircuitWorkoutOverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const queryClient = useQueryClient();
  const trpc = api();
  
  const [roundsData, setRoundsData] = useState<RoundData[]>([]);
  const [hasExercises, setHasExercises] = useState(false);
  const [setlist, setSetlist] = useState<any>(null);
  const [timingInfo, setTimingInfo] = useState<any>(null);
  
  // Modal state
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReplacement, setSelectedReplacement] = useState<string | null>(null);
  const [expandedMuscles, setExpandedMuscles] = useState<Set<string>>(new Set());
  const availableExercisesRef = useRef<any[]>([]);
  
  // Mirror update confirmation state
  const [showMirrorConfirm, setShowMirrorConfirm] = useState(false);
  const [mirrorRoundName, setMirrorRoundName] = useState("");
  const [pendingMirrorSwap, setPendingMirrorSwap] = useState<any>(null);

  // Set up the reorder mutation for circuits
  const reorderExerciseMutation = useMutation({
    ...trpc.workoutSelections.reorderCircuitExercise.mutationOptions(),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelections"]],
      });
    },
    onError: (error) => {
      console.error("Failed to reorder exercise:", error);
      alert("Failed to reorder exercise. Please try again.");
    },
  });

  // Set up the swap mutation for circuits
  const swapExerciseMutation = useMutation({
    ...trpc.workoutSelections.swapCircuitExercise.mutationOptions(),
    onSuccess: () => {
      // Close modal
      setShowExerciseSelection(false);
      setSelectedExercise(null);
      setSelectedReplacement(null);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelections"]],
      });
    },
    onError: (error) => {
      console.error("Failed to swap exercise:", error);
      alert("Failed to swap exercise. Please try again.");
    },
  });

  // Use real-time exercise swap updates
  useRealtimeExerciseSwaps({
    sessionId: sessionId || "",
    supabase,
    onSwapUpdate: (swap) => {
      console.log("[CircuitWorkoutOverview] Exercise swap detected:", swap);
      
      // Force refetch of exercise selections
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelections"]],
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
  const { data: savedSelections, isLoading: isLoadingSelections } = useQuery({
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
    return "";
  }, [savedSelections]);

  // Fetch available exercises when modal is open
  const { data: exercisesData, isLoading: isLoadingExercises } = useQuery({
    ...trpc.exercise.getAvailablePublic.queryOptions({
      sessionId: sessionId || "",
      userId: dummyUserId || "",
    }),
    enabled: !!sessionId && !!dummyUserId && showExerciseSelection,
  });

  const availableExercises = exercisesData?.exercises || [];

  // Keep ref updated with available exercises
  useEffect(() => {
    availableExercisesRef.current = availableExercises;
  }, [availableExercises]);

  // Process setlist and timing from templateConfig
  useEffect(() => {
    console.log('[DEBUG] Setlist processing - sessionData:', sessionData);
    console.log('[DEBUG] Setlist processing - circuitConfig:', circuitConfig);
    
    if (sessionData?.templateConfig && circuitConfig?.config) {
      const templateConfig = sessionData.templateConfig as any;
      
      // Check for setlist in multiple possible locations
      const setlistData = templateConfig.setlist || 
                         templateConfig.visualizationData?.llmResult?.metadata?.setlist;
      
      console.log('[DEBUG] Found setlist at:', setlistData ? 'Found' : 'Not found');
      console.log('[DEBUG] Setlist data:', setlistData);
      
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
    if (savedSelections && savedSelections.length > 0) {
      console.log("[CircuitWorkoutOverview] Processing selections:", savedSelections.length);
      console.log("[CircuitWorkoutOverview] Raw selections:", savedSelections);
      
      // Group exercises by round (using groupName)
      const roundsMap = new Map<string, typeof savedSelections>();
      
      // Use all exercises without deduplication to allow duplicates in the same round
      const allExercises = savedSelections;
      console.log("[CircuitWorkoutOverview] All exercises (no deduplication):", allExercises.length);
      
      // Group by round, excluding warm-up exercises
      allExercises.forEach((selection) => {
        const round = selection.groupName || 'Round 1';
        
        // Skip warm-up exercises from regular rounds
        if (round === 'Warm-up') {
          console.log("[CircuitWorkoutOverview] Excluding warm-up exercise from rounds:", selection.exerciseName);
          return;
        }
        
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push(selection);
      });
      
      // Sort exercises within each round and create final structure
      let rounds: RoundData[] = Array.from(roundsMap.entries())
        .map(([roundName, exercises]) => ({
          roundName,
          exercises: exercises
            .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
            .map((ex: any) => ({
              id: ex.id,
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              orderIndex: ex.orderIndex,
            }))
        }))
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

  // Filter exercises for the selection modal
  const filteredExercises = useMemo(() => {
    if (!showExerciseSelection || !selectedExercise) {
      return [];
    }

    console.log('[Exercise Modal] Starting exercise filtering', {
      totalAvailable: availableExercises.length,
      selectedRound,
      selectedExercise: selectedExercise?.exerciseName,
      searchQuery
    });

    // First filter by template type - only show exercises suitable for circuit
    let templateFiltered = availableExercises.filter((exercise) => {
      // If exercise has no templateType, include it (backwards compatibility)
      if (!exercise.templateType || exercise.templateType.length === 0) {
        return true;
      }
      // Check if exercise is tagged for circuit template
      return exercise.templateType.includes('circuit');
    });

    console.log('[Exercise Modal] After template filter:', {
      count: templateFiltered.length,
      filtered: templateFiltered.slice(0, 5).map(e => ({ name: e.name, templateType: e.templateType }))
    });

    // Then filter based on whether we're replacing a warm-up or regular exercise
    const isReplacingWarmup = selectedRound === 'Warm-up';
    
    if (isReplacingWarmup) {
      console.log('[Exercise Modal] Filtering for WARM-UP exercises');
      // When replacing warm-up exercises, ONLY show exercises with warmup_friendly tag
      // or warmup_only function tag
      templateFiltered = templateFiltered.filter((exercise: any) => {
        const hasWarmupFriendlyTag = exercise.movementTags?.includes('warmup_friendly');
        const hasWarmupOnlyFunction = exercise.functionTags?.includes('warmup_only');
        const include = hasWarmupFriendlyTag || hasWarmupOnlyFunction;
        
        if (include) {
          console.log('[Exercise Modal] Including warm-up exercise:', {
            name: exercise.name,
            movementTags: exercise.movementTags,
            functionTags: exercise.functionTags
          });
        }
        
        return include;
      });
    } else {
      console.log('[Exercise Modal] Filtering for REGULAR round exercises');
      // When replacing regular round exercises, EXCLUDE warmup_only exercises
      const beforeCount = templateFiltered.length;
      templateFiltered = templateFiltered.filter((exercise: any) => {
        const hasWarmupOnlyFunction = exercise.functionTags?.includes('warmup_only');
        if (hasWarmupOnlyFunction) {
          console.log('[Exercise Modal] Excluding warmup_only exercise:', exercise.name);
        }
        return !hasWarmupOnlyFunction;
      });
      console.log(`[Exercise Modal] Excluded ${beforeCount - templateFiltered.length} warmup_only exercises`);
    }

    console.log('[Exercise Modal] After warm-up filter:', {
      count: templateFiltered.length,
      isReplacingWarmup,
      sampleExercises: templateFiltered.slice(0, 5).map(e => e.name)
    });

    // Then filter by search query
    const searchFiltered = searchQuery.trim()
      ? filterExercisesBySearch(templateFiltered, searchQuery)
      : templateFiltered;

    console.log('[Exercise Modal] Final filtered exercises:', {
      count: searchFiltered.length,
      hasSearchQuery: !!searchQuery.trim()
    });

    // Return all filtered exercises (allowing duplicates)
    return searchFiltered;
  }, [availableExercises, searchQuery, showExerciseSelection, selectedExercise, selectedRound, roundsData]);

  // Group filtered exercises by muscle
  const groupedExercises = useMemo(() => {
    return groupByMuscle(filteredExercises);
  }, [filteredExercises]);

  // Toggle muscle group expansion
  const toggleMuscleGroup = (muscle: string) => {
    const newExpanded = new Set(expandedMuscles);
    if (newExpanded.has(muscle)) {
      newExpanded.delete(muscle);
    } else {
      newExpanded.add(muscle);
    }
    setExpandedMuscles(newExpanded);
  };


  // Reset states when modal closes
  useEffect(() => {
    if (!showExerciseSelection) {
      setSelectedExercise(null);
      setSelectedRound("");
      setSelectedExerciseIndex(0);
      setSelectedReplacement(null);
      setSearchQuery("");
    }
  }, [showExerciseSelection]);

  if (isLoadingSelections) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading circuit exercises...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md focus:outline-none focus:ring-0"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span>Back</span>
            </button>
            
            <div className="text-center">
              <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100">Circuit Overview</h1>
            </div>
            
            <Button
              size="sm"
              onClick={() => router.push('/workout-tv')}
              className="bg-green-600 hover:bg-green-700 text-white focus:outline-none focus:ring-0"
            >
              Finalize
            </Button>
          </div>
        </div>
      </div>

      {/* Content with top padding */}
      <div className="pt-16 p-4 pb-8">
        <div className="mx-auto max-w-md">

        {/* Total Time Display */}
        {timingInfo && (
          <Card className="mb-6 p-0 shadow-sm bg-white dark:bg-gray-800">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Total Time</h2>
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Work: {Math.floor(timingInfo.totalWorkTimeMs / 60000)}:{String(Math.floor((timingInfo.totalWorkTimeMs % 60000) / 1000)).padStart(2, '0')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Rest: {Math.floor(timingInfo.totalRestTimeMs / 60000)}:{String(Math.floor((timingInfo.totalRestTimeMs % 60000) / 1000)).padStart(2, '0')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {Math.floor(timingInfo.totalWorkoutDurationMs / 60000)}:{String(Math.floor((timingInfo.totalWorkoutDurationMs % 60000) / 1000)).padStart(2, '0')}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">minutes</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Warm-up Section */}
        {circuitConfig?.config?.warmup?.enabled && (
          <Card className="mb-6 p-0 shadow-sm border-2 bg-orange-50/50 dark:bg-amber-300/5 border-orange-200 dark:border-amber-300/25">
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
                  setSelectedExercise(exercise);
                  setSelectedRound(round);
                  setSelectedExerciseIndex(exerciseIndex);
                  setShowExerciseSelection(true);
                }}
              />
              </div>
            </div>
          </Card>
        )}

        {/* Content */}
        {roundsData.length > 0 ? (
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
                className={`${roundIndex === 0 ? 'mt-4' : ''} mb-6 p-0 shadow-sm border-2 ${(() => {
                  const type = round.roundType || 'circuit_round';
                  if (round.isRepeat) return 'bg-purple-50/50 dark:bg-violet-300/5 border-purple-200 dark:border-violet-300/25';
                  switch (type) {
                    case 'amrap_round':
                      return 'bg-purple-50/50 dark:bg-violet-300/5 border-purple-200 dark:border-violet-300/25';
                    case 'stations_round':
                      return 'bg-green-50/50 dark:bg-emerald-300/5 border-green-200 dark:border-emerald-300/25';
                    case 'circuit_round':
                    default:
                      return 'bg-blue-50/50 dark:bg-sky-300/5 border-blue-200 dark:border-sky-300/25';
                  }
                })()}`}
              >
                <div className="p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${(() => {
                        const type = round.roundType || 'circuit_round';
                        if (round.isRepeat) return 'bg-purple-500/20 dark:bg-violet-300/20 text-purple-700 dark:text-violet-200 ring-2 ring-purple-400/50 dark:ring-violet-300/40';
                        switch (type) {
                          case 'amrap_round':
                            return 'bg-purple-500/20 dark:bg-violet-300/20 text-purple-700 dark:text-violet-200 ring-2 ring-purple-400/50 dark:ring-violet-300/40';
                          case 'stations_round':
                            return 'bg-green-500/20 dark:bg-emerald-300/20 text-green-700 dark:text-emerald-200 ring-2 ring-green-400/50 dark:ring-emerald-300/40';
                          case 'circuit_round':
                          default:
                            return 'bg-blue-500/20 dark:bg-sky-300/20 text-blue-700 dark:text-sky-200 ring-2 ring-blue-400/50 dark:ring-sky-300/40';
                        }
                      })()}`}>
                        {round.roundName.match(/\d+/)?.[0] || ''}
                      </span>
                      <span className="flex items-center gap-2">
                        {round.roundName}
                        {round.isRepeat && (
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-violet-300/20 text-purple-700 dark:text-violet-200 rounded-full">
                            Repeat
                          </span>
                        )}
                      </span>
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      {(() => {
                        const roundType = round.roundType || 'circuit_round';
                        switch (roundType) {
                          case 'amrap_round':
                            return (
                              <>
                                <svg className="w-4 h-4 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>AMRAP • As many rounds as possible</span>
                              </>
                            );
                          case 'stations_round':
                            return (
                              <>
                                <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span>Stations • Team-based rotation</span>
                              </>
                            );
                          case 'circuit_round':
                          default:
                            return (
                              <>
                                <svg className="w-4 h-4 text-sky-500 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Circuit • {circuitConfig?.config?.workDuration || 45}s work / {circuitConfig?.config?.restDuration || 15}s rest</span>
                              </>
                            );
                        }
                      })()}
                    </p>
                  </div>
                
                  {/* HYPE Track - Plays at countdown */}
                  {roundMusic && (
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">🎵 HYPE</span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">Starts at 6s countdown</span>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{roundMusic.track1.trackName}</p>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-gray-600 dark:text-gray-400">Effective length</div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{track1Minutes}:{track1Seconds.toString().padStart(2, '0')}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  {round.exercises.map((exercise, idx) => (
                    <div key={exercise.id} className={`flex items-center justify-between p-4 rounded-xl transition-all min-h-[72px] focus-within:outline-none focus-within:ring-0 ${(() => {
                      const type = round.roundType || 'circuit_round';
                      if (round.isRepeat) return 'bg-purple-50/70 border border-purple-200/50 dark:bg-gray-800/50 dark:border-transparent';
                      switch (type) {
                        case 'amrap_round':
                          return 'bg-purple-50/70 border border-purple-200/50 dark:bg-gray-800/50 dark:border-transparent';
                        case 'stations_round':
                          return 'bg-green-50/70 border border-green-200/50 dark:bg-gray-800/50 dark:border-transparent';
                        case 'circuit_round':
                        default:
                          return 'bg-blue-50/70 border border-blue-200/50 dark:bg-gray-800/50 dark:border-transparent';
                      }
                    })()}`}>
                      <div className="flex items-center gap-4 flex-1">
                        <span className="w-8 h-8 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-base leading-tight py-1 text-gray-900 dark:text-gray-100">{exercise.exerciseName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Up button */}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={idx === 0 || reorderExerciseMutation.isPending}
                          onClick={() => {
                            reorderExerciseMutation.mutate({
                              sessionId: sessionId!,
                              roundName: round.roundName,
                              currentIndex: exercise.orderIndex,
                              direction: "up",
                            });
                          }}
                          className="h-8 w-8 p-0 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.5 8.75L7 5.25L3.5 8.75" />
                          </svg>
                        </Button>
                        
                        {/* Down button */}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={idx === round.exercises.length - 1 || reorderExerciseMutation.isPending}
                          onClick={() => {
                            reorderExerciseMutation.mutate({
                              sessionId: sessionId!,
                              roundName: round.roundName,
                              currentIndex: exercise.orderIndex,
                              direction: "down",
                            });
                          }}
                          className="h-8 w-8 p-0 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3.5 5.25L7 8.75L10.5 5.25" />
                          </svg>
                        </Button>
                        
                        {/* Replace button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedExercise(exercise);
                            setSelectedRound(round.roundName);
                            setSelectedExerciseIndex(exercise.orderIndex);
                            setShowExerciseSelection(true);
                          }}
                          className="h-8 px-3 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-0"
                        >
                          Replace
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* BRIDGE Track - Plays at exercise 2 */}
                  {roundMusic && roundMusic.track2 && (
                    <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">🎵 BRIDGE</span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">Starts at exercise 2</span>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{roundMusic.track2.trackName}</p>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-gray-600 dark:text-gray-400">When</div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">Exercise 2</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* REST Track - Plays at round end */}
                {roundMusic && roundMusic.track3 && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">🎵 REST</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">Plays at round end</span>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{roundMusic.track3.trackName}</p>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">When</div>
                        <div className="font-medium">Round End</div>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </Card>
            )})
            }
          </div>
        ) : (
          <Card className="p-16 text-center border-2 border-dashed dark:bg-gray-800 dark:border-gray-700">
            <div className="flex flex-col items-center justify-center">
              <div className="mb-6 w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-primary animate-pulse">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                Generating Your Circuit...
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md">
                The AI is creating your personalized circuit workout. This page will update automatically when ready.
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span>Checking for updates every 5 seconds</span>
              </div>
            </div>
          </Card>
        )}

        </div>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseSelection && (
        <>
          {/* Background overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              setShowExerciseSelection(false);
              setSelectedReplacement(null);
            }}
          />

          {/* Modal */}
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex h-[80vh] max-w-lg -translate-y-1/2 flex-col rounded-2xl bg-white dark:bg-gray-800 shadow-2xl">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Change Exercise
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Replacing: {selectedExercise?.exerciseName}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                    This will update the exercise for all participants
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowExerciseSelection(false);
                    setSelectedReplacement(null);
                  }}
                  className="rounded-lg p-2 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-0"
                >
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Search Bar */}
              <div className="sticky top-0 z-10 border-b bg-gray-50 dark:bg-gray-900 px-6 py-4">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isLoadingExercises}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-10 pr-4 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400"
                  />
                </div>
              </div>

              <div className="p-6">
                {/* Loading state */}
                {isLoadingExercises && (
                  <div className="py-8 text-center">
                    <SpinnerIcon className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <p className="text-gray-500 dark:text-gray-400">Loading exercises...</p>
                  </div>
                )}

                {/* No results message */}
                {!isLoadingExercises &&
                  searchQuery.trim() &&
                  filteredExercises.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-gray-500 dark:text-gray-400">
                        No exercises found matching "{searchQuery}"
                      </p>
                    </div>
                  )}

                {/* All exercises grouped by muscle */}
                {!isLoadingExercises && filteredExercises.length > 0 && (
                  <div className="space-y-3">
                    {groupedExercises.map(([muscle, exercises]) => (
                      <div key={muscle} className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700">
                        {/* Muscle group header */}
                        <button
                          onClick={() => toggleMuscleGroup(muscle)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-0"
                        >
                          <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                            {muscle.toLowerCase().replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                            </span>
                            <svg
                              className={`h-5 w-5 text-gray-400 dark:text-gray-500 transition-transform ${
                                expandedMuscles.has(muscle) ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </button>
                        
                        {/* Exercise list */}
                        {expandedMuscles.has(muscle) && (
                          <div className="border-t border-gray-100 dark:border-gray-600 px-4 py-2">
                            <div className="space-y-2">
                              {exercises.map((exercise: any) => (
                                <button
                                  key={exercise.id}
                                  onClick={() => setSelectedReplacement(exercise.id)}
                                  className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-0 ${
                                    selectedReplacement === exercise.id
                                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  <span className="font-medium text-black dark:text-gray-100">
                                    {exercise.name}
                                  </span>
                                  {exercise.movementPattern && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      MOVEMENT_PATTERN_COLORS[exercise.movementPattern] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                    }`}>
                                      {exercise.movementPattern.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state when no exercises available */}
                {!isLoadingExercises &&
                  !searchQuery.trim() &&
                  filteredExercises.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No exercises available</p>
                    </div>
                  )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 justify-end gap-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-6 py-4">
              <button
                onClick={() => {
                  setShowExerciseSelection(false);
                  setSelectedReplacement(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:ring-0"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedReplacement || !selectedExercise) return;

                  // Check if this is a base round with a mirror
                  if (circuitConfig?.config?.repeatRounds) {
                    const baseRoundCount = Math.floor(roundsData.length / 2);
                    const currentRoundIndex = roundsData.findIndex(r => r.roundName === selectedRound);
                    
                    if (currentRoundIndex < baseRoundCount) {
                      // This is a base round, find its mirror
                      const mirrorRoundIndex = currentRoundIndex + baseRoundCount;
                      const mirrorRound = roundsData[mirrorRoundIndex];
                      
                      if (mirrorRound) {
                        // Find the exercise at the same position in the mirror round
                        const currentRound = roundsData[currentRoundIndex];
                        const exercisePositionInRound = currentRound.exercises.findIndex(ex => ex.id === selectedExercise.id);
                        const mirrorExercise = mirrorRound.exercises[exercisePositionInRound];
                        
                        if (mirrorExercise && mirrorExercise.exerciseName === selectedExercise.exerciseName) {
                          // Store the swap details and show confirmation modal
                          setMirrorRoundName(mirrorRound.roundName);
                          setPendingMirrorSwap({
                            originalRound: selectedRound,
                            mirrorRound: mirrorRound.roundName,
                            mirrorExercise,
                            selectedExercise,
                            selectedReplacement,
                            selectedExerciseIndex
                          });
                          setShowMirrorConfirm(true);
                          setShowExerciseSelection(false);
                          return;
                        }
                      }
                    }
                  }

                  // Single exercise replacement
                  swapExerciseMutation.mutate({
                    sessionId: sessionId!,
                    roundName: selectedRound,
                    exerciseIndex: selectedExerciseIndex,
                    originalExerciseId: selectedExercise.exerciseId,
                    newExerciseId: selectedReplacement,
                    reason: "Circuit exercise swap",
                    swappedBy: dummyUserId || "unknown",
                  });
                }}
                disabled={
                  !selectedReplacement || swapExerciseMutation.isPending
                }
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors focus:outline-none focus:ring-0 ${
                  selectedReplacement && !swapExerciseMutation.isPending
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "cursor-not-allowed bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                {swapExerciseMutation.isPending ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                    Updating...
                  </>
                ) : (
                  "Confirm Change"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Mirror Update Confirmation Modal */}
      {showMirrorConfirm && pendingMirrorSwap && (
        <>
          {/* Background overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowMirrorConfirm(false)}
          />

          {/* Modal */}
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2">
            <Card className="p-6 shadow-2xl border-2 bg-white dark:bg-gray-800 dark:border-gray-700">
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
                      try {
                        await swapExerciseMutation.mutateAsync({
                          sessionId: sessionId!,
                          roundName: pendingMirrorSwap.originalRound,
                          exerciseIndex: pendingMirrorSwap.selectedExerciseIndex,
                          originalExerciseId: pendingMirrorSwap.selectedExercise.exerciseId,
                          newExerciseId: pendingMirrorSwap.selectedReplacement,
                          reason: "Circuit exercise swap",
                          swappedBy: dummyUserId || "unknown",
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
                      try {
                        // Update original
                        await swapExerciseMutation.mutateAsync({
                          sessionId: sessionId!,
                          roundName: pendingMirrorSwap.originalRound,
                          exerciseIndex: pendingMirrorSwap.selectedExerciseIndex,
                          originalExerciseId: pendingMirrorSwap.selectedExercise.exerciseId,
                          newExerciseId: pendingMirrorSwap.selectedReplacement,
                          reason: "Circuit exercise swap (with mirror)",
                          swappedBy: dummyUserId || "unknown",
                        });
                        
                        // Update mirror
                        await swapExerciseMutation.mutateAsync({
                          sessionId: sessionId!,
                          roundName: pendingMirrorSwap.mirrorRound,
                          exerciseIndex: pendingMirrorSwap.mirrorExercise.orderIndex,
                          originalExerciseId: pendingMirrorSwap.mirrorExercise.exerciseId,
                          newExerciseId: pendingMirrorSwap.selectedReplacement,
                          reason: "Circuit exercise swap (mirror round)",
                          swappedBy: dummyUserId || "unknown",
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
  
  console.log('[WarmupExercises] Component data:', { 
    savedSelectionsCount: savedSelections?.length,
    warmupExercisesCount: warmupExercises.length,
    warmupExercises: warmupExercises.map(ex => ({
      name: ex.exerciseName,
      orderIndex: ex.orderIndex,
      id: ex.id,
      exerciseId: ex.exerciseId
    })),
  });
  
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
        <div key={exercise.id} className="flex items-center justify-between p-4 rounded-xl bg-orange-50/70 border border-orange-200/50 dark:bg-gray-800/50 dark:border-transparent transition-all min-h-[72px] focus-within:outline-none focus-within:ring-0">
          <div className="flex items-center gap-4 flex-1">
            <span className="w-8 h-8 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0">
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