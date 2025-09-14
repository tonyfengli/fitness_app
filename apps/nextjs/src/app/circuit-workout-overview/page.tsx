"use client";

import React, { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  Button, 
  Loader2Icon as Loader2, 
  useRealtimeExerciseSwaps,
  SearchIcon,
  SpinnerIcon,
  XIcon,
  filterExercisesBySearch,
} from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";
import { api } from "~/trpc/react";

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
      
      // Group exercises by round (using groupName)
      const roundsMap = new Map<string, typeof savedSelections>();
      
      // Deduplicate exercises since circuit exercises are shared
      const uniqueExercises = new Map<string, any>();
      
      savedSelections.forEach((selection: any) => {
        const key = `${selection.exerciseId}-${selection.groupName}`;
        if (!uniqueExercises.has(key)) {
          uniqueExercises.set(key, selection);
        }
      });
      
      // Group by round
      uniqueExercises.forEach((selection) => {
        const round = selection.groupName || 'Round 1';
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
      
      // Mark which rounds are repeats
      const roundsWithMetadata = rounds.map((round, index) => ({
        ...round,
        isRepeat: circuitConfig?.config?.repeatRounds && index >= baseRoundCount
      }));
      
      setRoundsData(roundsWithMetadata);
      setHasExercises(true);
    }
  }, [savedSelections, circuitConfig]);

  // Filter exercises for the selection modal
  const filteredExercises = useMemo(() => {
    if (!showExerciseSelection || !selectedExercise) {
      return [];
    }

    // Get already selected exercise IDs from all rounds
    const selectedIds = new Set(
      roundsData.flatMap(round => round.exercises.map(ex => ex.exerciseId))
    );

    // First filter by template type - only show exercises suitable for circuit
    const templateFiltered = availableExercises.filter((exercise) => {
      // If exercise has no templateType, include it (backwards compatibility)
      if (!exercise.templateType || exercise.templateType.length === 0) {
        return true;
      }
      // Check if exercise is tagged for circuit template
      return exercise.templateType.includes('circuit');
    });

    // Then filter by search query
    const searchFiltered = searchQuery.trim()
      ? filterExercisesBySearch(templateFiltered, searchQuery)
      : templateFiltered;

    // Finally remove already selected exercises
    return searchFiltered.filter((exercise) => !selectedIds.has(exercise.id));
  }, [availableExercises, searchQuery, showExerciseSelection, selectedExercise, roundsData]);

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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Circuit Workout Overview
            </h1>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-lg text-muted-foreground font-medium">
                {roundsData.length} rounds × {circuitConfig?.config?.exercisesPerRound || 0} exercises
              </span>
              {circuitConfig?.config?.repeatRounds && (
                <span className="px-3 py-1 text-sm font-semibold bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 rounded-full border border-purple-500/30">
                  {circuitConfig.config.rounds} base + {circuitConfig.config.rounds} repeat
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/sessions/${sessionId}/circuit-config?step=5`)}
              className="font-medium"
            >
              Music Controls
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="font-medium"
            >
              ← Back
            </Button>
          </div>
        </div>

        {/* Content */}
        {roundsData.length > 0 ? (
          <div className="grid gap-6">
            {roundsData.map((round) => (
              <Card 
                key={round.roundName} 
                className={`p-8 border-2 shadow-lg hover:shadow-xl transition-all ${
                  round.isRepeat 
                    ? 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/10 dark:to-indigo-950/10 border-purple-400 dark:border-purple-500/40' 
                    : ''
                }`}
              >
                <h2 className="mb-6 text-2xl font-bold flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    round.isRepeat 
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-2 ring-purple-400 dark:ring-purple-500/50' 
                      : 'bg-primary/10 text-primary'
                  }`}>
                    {round.roundName.match(/\d+/)?.[0] || ''}
                  </span>
                  <span className="flex items-center gap-3">
                    {round.roundName}
                    {round.isRepeat && (
                      <span className="px-3 py-1 text-sm font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                        Repeat
                      </span>
                    )}
                  </span>
                </h2>
                <div className="space-y-3">
                  {round.exercises.map((exercise, idx) => (
                    <div key={exercise.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all border border-transparent hover:border-primary/20 min-h-[72px]">
                      <div className="flex items-center gap-4 flex-1">
                        <span className="w-8 h-8 bg-background rounded-lg flex items-center justify-center text-sm font-semibold text-muted-foreground flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-lg leading-tight py-1">{exercise.exerciseName}</span>
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
                          className="h-8 w-8 p-0 disabled:opacity-50"
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
                          className="h-8 w-8 p-0 disabled:opacity-50"
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
                          className="h-8 px-3 font-medium"
                        >
                          Replace
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            
          </div>
        ) : (
          <Card className="p-16 text-center border-2 border-dashed">
            <div className="flex flex-col items-center justify-center">
              <div className="mb-6 w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-primary animate-pulse">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="mb-3 text-2xl font-bold">
                Generating Your Circuit...
              </h2>
              <p className="text-muted-foreground max-w-md">
                The AI is creating your personalized circuit workout. This page will update automatically when ready.
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span>Checking for updates every 5 seconds</span>
              </div>
            </div>
          </Card>
        )}

        {/* Music Setlist Section */}
        {setlist && timingInfo && circuitConfig && (
          <Card className="mt-6 p-8 border-2 shadow-lg bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20">
            <h2 className="mb-6 text-2xl font-bold flex items-center gap-3">
              <span className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                🎵
              </span>
              <span>Music Setlist</span>
            </h2>
            
            <div className="space-y-4">
              {setlist.rounds.map((round: any, index: number) => {
                const roundTiming = timingInfo.rounds[index];
                const roundDurationSec = Math.floor(roundTiming.totalDurationMs / 1000);
                const roundMinutes = Math.floor(roundDurationSec / 60);
                const roundSeconds = roundDurationSec % 60;
                
                // Calculate effective duration for track 1 (hype track)
                // Note: If durationMs is missing, the workout was generated before tracks were in DB
                const track1EffectiveDuration = round.track1.durationMs ? getEffectiveTrackDuration(
                  round.track1.durationMs,
                  round.track1.hypeTimestamp
                ) : 0;
                const track1EffectiveSec = Math.floor(track1EffectiveDuration / 1000);
                const track1Minutes = Math.floor(track1EffectiveSec / 60);
                const track1Seconds = track1EffectiveSec % 60;
                
                // Log if duration is missing
                if (!round.track1.durationMs) {
                  console.warn(`[Setlist] Track ${round.track1.trackName} missing durationMs - workout needs regeneration`);
                }
                
                return (
                  <div key={round.roundNumber} className="p-6 rounded-xl bg-white/50 dark:bg-gray-800/50 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <span className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-sm font-bold">
                          {round.roundNumber}
                        </span>
                        Round {round.roundNumber}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Round Duration:</span> {roundMinutes}:{roundSeconds.toString().padStart(2, '0')}
                      </div>
                    </div>
                    
                    <div className="grid gap-3">
                      {/* Track 1 - Hype */}
                      <div className="p-4 rounded-lg bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">HYPE</span>
                              <span className="text-xs text-muted-foreground">Starts at 6s countdown</span>
                            </div>
                            <p className="font-medium">{round.track1.trackName}</p>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-muted-foreground">Effective length</div>
                            <div className="font-medium">{track1Minutes}:{track1Seconds.toString().padStart(2, '0')}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Track 2 - Rest or Bridge */}
                      <div className={`p-4 rounded-lg border ${
                        round.track2.usage === 'rest' 
                          ? 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800'
                          : 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                round.track2.usage === 'rest'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              }`}>
                                {round.track2.usage.toUpperCase()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {round.coverageScenario === 'full-coverage' 
                                  ? 'Plays during rest between rounds'
                                  : 'Bridges to complete the round'}
                              </span>
                            </div>
                            <p className="font-medium">{round.track2.trackName}</p>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-muted-foreground">Type</div>
                            <div className="font-medium capitalize">{round.track2.usage}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Total Workout Duration:</span> {Math.floor(timingInfo.totalWorkoutDurationMs / 60000)}:{Math.floor((timingInfo.totalWorkoutDurationMs % 60000) / 1000).toString().padStart(2, '0')}
              </p>
            </div>
          </Card>
        )}

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
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex h-[80vh] max-w-lg -translate-y-1/2 flex-col rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Change Exercise
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Replacing: {selectedExercise?.exerciseName}
                  </p>
                  <p className="text-xs text-amber-600 font-medium mt-1">
                    This will update the exercise for all participants
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowExerciseSelection(false);
                    setSelectedReplacement(null);
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Search Bar */}
              <div className="sticky top-0 z-10 border-b bg-gray-50 px-6 py-4">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isLoadingExercises}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              </div>

              <div className="p-6">
                {/* Loading state */}
                {isLoadingExercises && (
                  <div className="py-8 text-center">
                    <SpinnerIcon className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
                    <p className="text-gray-500">Loading exercises...</p>
                  </div>
                )}

                {/* No results message */}
                {!isLoadingExercises &&
                  searchQuery.trim() &&
                  filteredExercises.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-gray-500">
                        No exercises found matching "{searchQuery}"
                      </p>
                    </div>
                  )}

                {/* All exercises grouped by muscle */}
                {!isLoadingExercises && filteredExercises.length > 0 && (
                  <div className="space-y-3">
                    {groupedExercises.map(([muscle, exercises]) => (
                      <div key={muscle} className="rounded-lg border border-gray-200 bg-white">
                        {/* Muscle group header */}
                        <button
                          onClick={() => toggleMuscleGroup(muscle)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900 capitalize">
                            {muscle.toLowerCase().replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                            </span>
                            <svg
                              className={`h-5 w-5 text-gray-400 transition-transform ${
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
                          <div className="border-t border-gray-100 px-4 py-2">
                            <div className="space-y-2">
                              {exercises.map((exercise: any) => (
                                <button
                                  key={exercise.id}
                                  onClick={() => setSelectedReplacement(exercise.id)}
                                  className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors ${
                                    selectedReplacement === exercise.id
                                      ? 'bg-indigo-50 text-indigo-700'
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <span className="font-medium text-black">
                                    {exercise.name}
                                  </span>
                                  {exercise.movementPattern && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      MOVEMENT_PATTERN_COLORS[exercise.movementPattern] || 'bg-gray-100 text-gray-800'
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
                      <p className="text-gray-500">No exercises available</p>
                    </div>
                  )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 justify-end gap-3 border-t bg-gray-50 px-6 py-4">
              <button
                onClick={() => {
                  setShowExerciseSelection(false);
                  setSelectedReplacement(null);
                }}
                className="px-4 py-2 text-gray-700 transition-colors hover:text-gray-900"
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
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                  selectedReplacement && !swapExerciseMutation.isPending
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "cursor-not-allowed bg-gray-300 text-gray-500"
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
            <Card className="p-6 shadow-2xl border-2">
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