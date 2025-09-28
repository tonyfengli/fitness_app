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
  ChevronUpIcon,
  ChevronDownIcon,
  useRealtimeExerciseSwaps,
  SearchIcon,
  SpinnerIcon,
  XIcon,
  filterExercisesBySearch,
  cn,
  MUSCLE_UNIFICATION,
} from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";
import { api, useTRPC } from "~/trpc/react";

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
  
  // Inline editing state
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [inlineSearchQuery, setInlineSearchQuery] = useState("");
  const [inlineSelectedId, setInlineSelectedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ type: 'muscle' | 'movement' | 'equipment', value: string } | null>(null);
  const [categoryMode, setCategoryMode] = useState<'choice' | 'muscle' | 'movement' | 'equipment'>('choice');
  
  // Spotify section expansion state
  const [expandedSpotifyRounds, setExpandedSpotifyRounds] = useState<Set<string>>(new Set());
  
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
      
      // Reset inline editing state
      setEditingExerciseId(null);
      setInlineSearchQuery("");
      setInlineSelectedId(null);

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

  // Fetch available exercises when modal is open or inline editing
  const { data: exercisesData, isLoading: isLoadingExercises } = useQuery({
    ...trpc.exercise.getAvailablePublic.queryOptions({
      sessionId: sessionId || "",
      userId: dummyUserId || "",
    }),
    enabled: !!sessionId && !!dummyUserId && (showExerciseSelection || !!editingExerciseId),
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
      searchQuery,
      sampleExercises: availableExercises.slice(0, 3).map(ex => ({
        name: ex.name,
        equipment: ex.equipment,
        equipmentType: typeof ex.equipment,
        equipmentIsArray: Array.isArray(ex.equipment)
      }))
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

  // Prevent body scroll when inline modal is open
  useEffect(() => {
    if (editingExerciseId) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = '';
      };
    }
  }, [editingExerciseId]);

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
        <div className="mx-auto max-w-2xl">
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
      <div className="pt-16 px-4 pb-8">
        <div className="mx-auto max-w-2xl">


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
                className={`${roundIndex === 0 ? 'mt-4' : ''} mb-6 p-0 shadow-sm bg-white dark:bg-gray-800`}
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
                            const amrapRoundTemplate = circuitConfig?.config?.roundTemplates?.find(rt => rt.roundNumber === parseInt(round.roundName.match(/\d+/)?.[0] || '1'));
                            const amrapDuration = amrapRoundTemplate?.template?.totalDuration ? Math.floor(amrapRoundTemplate.template.totalDuration / 60) : 5;
                            return (
                              <>
                                <svg className="w-4 h-4 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>AMRAP • {amrapDuration} min rounds / {circuitConfig?.config?.restBetweenRounds || 60}s rest</span>
                              </>
                            );
                          case 'stations_round':
                            const stationsRoundTemplate = circuitConfig?.config?.roundTemplates?.find(rt => rt.roundNumber === parseInt(round.roundName.match(/\d+/)?.[0] || '1'));
                            const stationsWorkDuration = stationsRoundTemplate?.template?.workDuration || circuitConfig?.config?.workDuration || 60;
                            const stationsRestDuration = stationsRoundTemplate?.template?.restDuration || circuitConfig?.config?.restDuration || 15;
                            return (
                              <>
                                <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span>Stations • {stationsWorkDuration}s work / {stationsRestDuration}s transition</span>
                              </>
                            );
                          case 'circuit_round':
                          default:
                            const circuitRoundTemplate = circuitConfig?.config?.roundTemplates?.find(rt => rt.roundNumber === parseInt(round.roundName.match(/\d+/)?.[0] || '1'));
                            const circuitWorkDuration = circuitRoundTemplate?.template?.workDuration || circuitConfig?.config?.workDuration || 45;
                            const circuitRestDuration = circuitRoundTemplate?.template?.restDuration || circuitConfig?.config?.restDuration || 15;
                            return (
                              <>
                                <svg className="w-4 h-4 text-sky-500 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Circuit • {circuitWorkDuration}s work / {circuitRestDuration}s rest</span>
                              </>
                            );
                        }
                      })()}
                    </p>
                  </div>
                
                
                <div className="space-y-3">
                  {round.exercises.map((exercise, idx) => {
                    const isEditing = editingExerciseId === exercise.id;
                    return (
                      <div key={exercise.id} className="relative">
                        <div className="p-6 rounded-xl transition-all focus-within:outline-none focus-within:ring-0 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${(() => {
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
                                  {idx + 1}
                                </span>
                                {/* Reorder buttons - subtle positioning */}
                                {!isEditing && (
                                  <div className="flex flex-col gap-1">
                                    <button
                                      disabled={idx === 0 || reorderExerciseMutation.isPending}
                                      onClick={() => {
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
                              <span className="font-medium text-base leading-tight py-1 text-gray-900 dark:text-gray-100">{exercise.exerciseName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isEditing ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingExerciseId(exercise.id);
                                    setInlineSearchQuery("");
                                    setInlineSelectedId(null);
                                    setSelectedCategory(null);
                                    setCategoryMode('choice');
                                  }}
                                  className="h-8 px-3 font-medium dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-0"
                                >
                                  Replace
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        
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

      {/* Inline Exercise Replacement Modal */}
      {editingExerciseId && (() => {
        const editingExercise = roundsData.flatMap(r => r.exercises).find(ex => ex.id === editingExerciseId);
        const editingRound = roundsData.find(r => r.exercises.some(ex => ex.id === editingExerciseId));
        const exerciseIndex = editingRound?.exercises.findIndex(ex => ex.id === editingExerciseId) ?? 0;
        
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

            {/* Modal */}
            <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex h-[80vh] max-w-2xl -translate-y-1/2 flex-col rounded-2xl bg-gray-50 dark:bg-gray-900 shadow-2xl overflow-hidden">
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
                            swapExerciseMutation.mutate({
                              sessionId: sessionId!,
                              roundName: editingRound.roundName,
                              exerciseIndex: editingExercise.orderIndex,
                              originalExerciseId: editingExercise.exerciseId,
                              newExerciseId: inlineSelectedId || null, // null for custom exercises
                              customName: inlineSelectedId ? undefined : inlineSearchQuery.trim(), // custom name if no selection
                              reason: "Circuit exercise swap",
                              swappedBy: dummyUserId || "unknown",
                            });
                          }
                        }}
                        disabled={(!inlineSelectedId && !inlineSearchQuery.trim()) || swapExerciseMutation.isPending}
                        className={`h-12 px-10 text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-0 ${
                          (inlineSelectedId || inlineSearchQuery.trim()) && !swapExerciseMutation.isPending
                            ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-md' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {swapExerciseMutation.isPending ? (
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
                        console.log('[DEBUG] Equipment filtering:', {
                          selectedEquipment: selectedCategory.value,
                          totalExercises: filtered.length,
                          sampleExercises: filtered.slice(0, 5).map(ex => ({
                            name: ex.name,
                            equipment: ex.equipment,
                            equipmentType: typeof ex.equipment,
                            equipmentIsArray: Array.isArray(ex.equipment),
                            equipmentLength: Array.isArray(ex.equipment) ? ex.equipment.length : 'N/A'
                          }))
                        });
                        
                        // Log exercises that have any equipment data
                        const exercisesWithEquipment = filtered.filter(ex => ex.equipment && (Array.isArray(ex.equipment) ? ex.equipment.length > 0 : true));
                        console.log('[DEBUG] Exercises with equipment data:', {
                          count: exercisesWithEquipment.length,
                          sample: exercisesWithEquipment.slice(0, 3).map(ex => ({
                            name: ex.name,
                            equipment: ex.equipment
                          }))
                        });
                        
                        filtered = filtered.filter((ex: any) => {
                          // Log each exercise's equipment data
                          if (filtered.length <= 10) { // Only log first 10 to avoid spam
                            console.log(`[DEBUG] Exercise "${ex.name}" equipment:`, {
                              equipment: ex.equipment,
                              type: typeof ex.equipment,
                              isArray: Array.isArray(ex.equipment)
                            });
                          }
                          
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
                        
                        console.log('[DEBUG] Equipment filtering results:', {
                          selectedEquipment: selectedCategory.value,
                          filteredCount: filtered.length,
                          filteredExercises: filtered.slice(0, 5).map(ex => ex.name)
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
                                    { value: 'bodyweight', label: 'Bodyweight' },
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