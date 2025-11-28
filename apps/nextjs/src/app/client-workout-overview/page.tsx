"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  categorizeExercisesByRecommendation,
  ExerciseListItem,
  filterExercisesBySearch,
  SearchIcon,
  SpinnerIcon,
  useRealtimeExerciseSwaps,
  useRealtimeWorkoutExercises,
  useRealtimeStatus,
  XIcon,
  MuscleHistoryModal,
  useModalState,
  MUSCLE_UNIFICATION,
} from "@acme/ui-shared";

import { supabase } from "~/lib/supabase";
import { useTRPC } from "~/trpc/react";

const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

interface SelectedExercise {
  exerciseId: string;
  exerciseName: string;
  customExercise?: {
    customName?: string;
    originalExerciseId?: string;
  };
  isShared: boolean;
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

// Helper function to select top N exercises with tie-breaking
const selectTopWithTieBreaking = (exercises: any[], count: number): any[] => {
  if (exercises.length === 0 || count <= 0) return [];
  if (exercises.length <= count) return exercises;

  const selected: any[] = [];
  const used = new Set<string>();

  while (selected.length < count && exercises.length > used.size) {
    // Find the highest score among unused exercises
    let highestScore = -Infinity;
    for (const ex of exercises) {
      if (!used.has(ex.id) && ex.score > highestScore) {
        highestScore = ex.score;
      }
    }

    // Get all exercises with the highest score
    const tied = exercises.filter(
      (ex) => !used.has(ex.id) && ex.score === highestScore
    );

    if (tied.length === 0) break;

    // If we need more exercises than tied, take all tied
    const remaining = count - selected.length;
    if (tied.length <= remaining) {
      tied.forEach((ex) => {
        selected.push(ex);
        used.add(ex.id);
      });
    } else {
      // Randomly select from tied exercises
      for (let i = 0; i < remaining; i++) {
        const availableTied = tied.filter((ex) => !used.has(ex.id));
        if (availableTied.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableTied.length);
          const randomEx = availableTied[randomIndex];
          if (randomEx) {
            selected.push(randomEx);
            used.add(randomEx.id);
          }
        }
      }
    }
  }

  return selected;
};

// Group exercises by unified muscle categories
const groupByMuscle = (exercises: any[]) => {
  const grouped = exercises.reduce((acc, exercise) => {
    const unifiedMuscle = getUnifiedMuscleGroup(exercise.primaryMuscle);
    if (!acc[unifiedMuscle]) acc[unifiedMuscle] = [];
    acc[unifiedMuscle].push(exercise);
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

function ClientWorkoutOverviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId");
  const userId = searchParams.get("userId");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [realtimeExercises, setRealtimeExercises] = useState<any[]>([]);

  // Set up the mutation with optimistic updates
  const swapExerciseMutation = useMutation({
    ...trpc.workoutSelections.swapExercisePublic.mutationOptions(),
    onMutate: async ({
      originalExerciseId,
      newExerciseId,
      clientId,
      sessionId,
    }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [["workoutSelections", "getSelectionsPublic"]],
      });

      // Find the new exercise details
      const newExercise = availableExercisesRef.current.find(
        (ex) => ex.id === newExerciseId,
      );
      if (!newExercise) return;

      // Snapshot previous values
      const selectionsKey =
        trpc.workoutSelections.getSelectionsPublic.queryOptions({
          sessionId,
          clientId,
        }).queryKey;
      const previousSelections = queryClient.getQueryData(selectionsKey);

      // Optimistically update the selections
      queryClient.setQueryData(selectionsKey, (old: any) => {
        if (!old) return old;
        return old.map((selection: any) =>
          selection.exerciseId === originalExerciseId
            ? {
                ...selection,
                exerciseId: newExerciseId,
                exerciseName: newExercise.name,
                selectionSource: "manual_swap",
              }
            : selection,
        );
      });

      return { previousSelections };
    },
    onSuccess: () => {
      // Close modals
      setShowExerciseSelection(false);
      setModalOpen(false);
      setSelectedExercise(null);
      setSelectedReplacement(null);

      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelectionsPublic"]],
      });
      queryClient.invalidateQueries({
        queryKey: [["trainingSession", "getSavedVisualizationDataPublic"]],
      });
      // Invalidate muscle coverage to update the Targets to Hit modal
      queryClient.invalidateQueries({
        queryKey: [["muscleCoverage", "getClientMuscleCoverage"]],
      });
    },
    onError: (error, variables, context) => {
      console.error("Failed to swap exercise:", error);

      // Revert optimistic update
      if (context?.previousSelections) {
        const selectionsKey =
          trpc.workoutSelections.getSelectionsPublic.queryOptions({
            sessionId: variables.sessionId,
            clientId: variables.clientId,
          }).queryKey;
        queryClient.setQueryData(selectionsKey, context.previousSelections);
      }

      alert("Failed to swap exercise. Please try again.");
    },
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<
    number | null
  >(null);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReplacement, setSelectedReplacement] = useState<string | null>(
    null,
  );
  const [expandedMuscles, setExpandedMuscles] = useState<Set<string>>(new Set());
  const availableExercisesRef = useRef<any[]>([]);
  const [hasExercises, setHasExercises] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showFullExerciseList, setShowFullExerciseList] = useState(false);
  const [muscleSectionCount, setMuscleSectionCount] = useState(3);
  const [otherSectionCount, setOtherSectionCount] = useState(3);
  const muscleHistoryModal = useModalState();
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderedExercises, setReorderedExercises] = useState<any[]>([]);

  // Mutation to update client status to workout_ready
  const updateStatusMutation = useMutation({
    ...trpc.trainingSession.updateClientReadyStatusPublic.mutationOptions({
      onSuccess: (data) => {
        // Set local ready state
        setIsReady(true);
      },
      onError: (error) => {
        console.error("Failed to update status:", error);
        alert("Failed to update status. Please try again.");
      },
    }),
  });

  // Mutation to update exercise order
  const updateExerciseOrderMutation = useMutation({
    ...trpc.workoutSelections.updateExerciseOrderPublic.mutationOptions({
      onSuccess: () => {
        // Exit reorder mode
        setIsReorderMode(false);
        setReorderedExercises([]);
        
        // Invalidate queries to refetch with new order
        queryClient.invalidateQueries({
          queryKey: [["workoutSelections", "getSelectionsPublic"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["trainingSession", "getSavedVisualizationDataPublic"]],
        });
      },
      onError: (error) => {
        console.error("Failed to update exercise order:", error);
        alert("Failed to update order. Please try again.");
        // Reset to original order
        setReorderedExercises([]);
      },
    }),
  });

  // Use real-time workout exercises
  useRealtimeWorkoutExercises({
    sessionId: sessionId || "",
    userId: userId || "",
    supabase,
    onExercisesUpdate: (exercises) => {
      console.log('[ClientWorkoutOverview] Real-time exercises received:', {
        count: exercises.length,
        hasVisualizationData: !!visualizationData,
        hasBlueprint: !!visualizationData?.blueprint,
        timestamp: new Date().toISOString()
      });
      setRealtimeExercises(exercises);
      // Force refetch of visualization data when exercises arrive
      console.log('[ClientWorkoutOverview] Invalidating queries to refetch visualization data');
      queryClient.invalidateQueries({
        queryKey: [["trainingSession", "getSavedVisualizationDataPublic"]],
      });
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelectionsPublic"]],
      });
    },
    onError: (error) => {
      console.error("[ClientWorkoutOverview] Real-time error:", error);
    },
  });

  // Use real-time exercise swap updates
  const { isConnected: swapUpdatesConnected } = useRealtimeExerciseSwaps({
    sessionId: sessionId || "",
    supabase,
    onSwapUpdate: (swap) => {

      // Force refetch of exercise selections and visualization data
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelectionsPublic"]],
      });
      queryClient.invalidateQueries({
        queryKey: [["trainingSession", "getSavedVisualizationDataPublic"]],
      });
      // Invalidate muscle coverage to update the Targets to Hit modal
      queryClient.invalidateQueries({
        queryKey: [["muscleCoverage", "getClientMuscleCoverage"]],
      });
    },
    onError: (error) => {
      console.error("[ClientWorkoutOverview] Swap updates error:", error);
    },
  });

  // Use real-time status updates
  const { isConnected: statusConnected } = useRealtimeStatus({
    sessionId: sessionId || "",
    supabase,
    onStatusUpdate: (update) => {
      // Update ready state if this is the current user
      if (update.userId === userId && update.status === 'workout_ready') {
        setIsReady(true);
      }
    },
    onError: (error) => {
      console.error("[ClientWorkoutOverview] Status updates error:", error);
    },
  });

  // Fetch visualization data
  const {
    data: visualizationData,
    isLoading,
    error: visualizationError,
    refetch: refetchVisualization,
  } = useQuery({
    ...trpc.trainingSession.getSavedVisualizationDataPublic.queryOptions({
      sessionId: sessionId || "",
      userId: userId || "",
    }),
    enabled: !!sessionId && !!userId,
    // Poll until we have blueprint candidates, not just exercises
    refetchInterval: (data) => {
      const shouldPoll = !data?.blueprint?.clientExercisePools?.[userId]?.availableCandidates;
      // Use faster polling (2s) initially when no exercises, then 5s once exercises are loaded
      const pollInterval = !hasExercises ? 2000 : 5000;
      return shouldPoll ? pollInterval : false;
    },
    onError: (error) => {
      console.error('[ClientWorkoutOverview] Visualization data error:', error);
    }
  });

  
  

  // Fetch user info directly from client preference data
  const { data: clientInfoResponse } = useQuery({
    ...trpc.trainingSession.getClientPreferenceData.queryOptions({
      sessionId: sessionId || "",
      userId: userId || "",
    }),
    enabled: !!sessionId && !!userId,
  });

  // Also fetch saved selections (always, not just as fallback)
  const { data: savedSelections } = useQuery({
    ...trpc.workoutSelections.getSelectionsPublic.queryOptions({
      sessionId: sessionId || "",
      clientId: userId || "",
    }),
    enabled: !!sessionId && !!userId,
    // Poll every 2s initially when no exercises are loaded yet
    refetchInterval: !hasExercises ? 2000 : false,
  });

  
  

  // Pre-fetch available exercises as soon as we have a session
  const { data: exercisesData, isLoading: isLoadingExercises } = useQuery({
    ...trpc.exercise.getAvailablePublic.queryOptions({
      sessionId: sessionId || "",
      userId: userId || "",
    }),
    enabled: !!sessionId && !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const availableExercises = exercisesData?.exercises || [];

  // Fetch user's favorite exercises
  const { data: favoritesData, isLoading: isLoadingFavorites } = useQuery({
    ...trpc.exercise.getUserFavoritesPublic.queryOptions({
      sessionId: sessionId || "",
      userId: userId || "",
    }),
    enabled: !!sessionId && !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const favoriteExercises = favoritesData?.favorites || [];

  // Keep ref updated with available exercises
  useEffect(() => {
    availableExercisesRef.current = availableExercises;
  }, [availableExercises]);

  // Extract exercises for this specific client
  const clientExercises = useMemo(() => {
    // First check if we have real-time exercises
    if (realtimeExercises.length > 0) {
      return realtimeExercises.map((exercise, index) => ({
        id: exercise.exerciseId,
        name: exercise.exerciseName || exercise.name,
        primaryMuscle: exercise.primaryMuscle, // Will be undefined initially
        source: "llm_phase1",
        customExercise: undefined,
        isShared: exercise.isShared || false,
        isPreAssigned: false,
        orderIndex: exercise.orderIndex || 999,
      }));
    }

    // Then try to use saved selections (source of truth after swaps)
    if (savedSelections && savedSelections.length > 0) {
      return savedSelections.map((selection: any, index: number) => ({
        id: selection.exerciseId,
        name: selection.exerciseName,
        primaryMuscle: undefined, // Will be populated later
        source: selection.selectionSource,
        customExercise: selection.custom_exercise,
        isShared: selection.isShared || false,
        isPreAssigned: selection.selectionSource === "pre_assigned",
        orderIndex: selection.orderIndex || 999,
      }));
    }

    // Fall back to visualization data if no saved selections
    if (!visualizationData || !userId) return [];

    const llmResult = visualizationData.llmResult;
    const groupContext = visualizationData.groupContext;

    if (!llmResult || !groupContext) {
      return [];
    }


    // Find the client's information
    const clientIndex = groupContext.clients.findIndex(
      (c: any) => c.user_id === userId,
    );
    if (clientIndex === -1) {
      return [];
    }

    const client = groupContext.clients[clientIndex];
    const exercises: any[] = [];

    // Get pre-assigned exercises from the blueprint
    const blueprint = visualizationData.blueprint;

    if (blueprint?.clientExercisePools?.[userId]) {
      const preAssigned =
        blueprint.clientExercisePools[userId].preAssigned || [];
      preAssigned.forEach((pa: any, index: number) => {
        exercises.push({
          id: pa.exercise.id,
          name: pa.exercise.name,
          source: pa.source,
          customExercise: undefined,
          isPreAssigned: true,
          orderIndex: index,
        });
      });
    } else {
    }

    // Get LLM selected exercises

    // Check multiple possible paths for the LLM selections
    let llmSelections = null;

    // First, check if exerciseSelection is a string that needs parsing
    let exerciseSelection = llmResult.exerciseSelection;
    if (typeof exerciseSelection === "string") {
      try {
        exerciseSelection = JSON.parse(exerciseSelection);
      } catch (e) {
      }
    }

    // Path 1: exerciseSelection.clientSelections
    if (exerciseSelection?.clientSelections?.[userId]) {
      // The structure uses 'selected' not 'selectedExercises'
      llmSelections =
        exerciseSelection.clientSelections[userId].selected ||
        exerciseSelection.clientSelections[userId].selectedExercises;
    }
    // Path 2: Direct clientSelections
    else if (llmResult.clientSelections?.[userId]) {
      llmSelections =
        llmResult.clientSelections[userId].selected ||
        llmResult.clientSelections[userId].selectedExercises;
    }
    // Path 3: Check if we need to use client index instead of userId
    else if (exerciseSelection?.clientSelections) {
      // Try using the client index from groupContext
      const clientKey = `client_${clientIndex}`;
      if (exerciseSelection.clientSelections[clientKey]) {
        llmSelections =
          exerciseSelection.clientSelections[clientKey].selectedExercises;
      }
    }
    // Path 4: llmAssignments for BMF templates
    else if (llmResult.llmAssignments) {
      // Look for user in llmAssignments structure
    }

    if (llmSelections) {
      llmSelections.forEach((ex: any, index: number) => {
        // Handle different possible structures
        const exercise = {
          id: ex.exerciseId || ex.id,
          name: ex.exerciseName || ex.name,
          customExercise: ex.custom_exercise,
          isShared: ex.isShared || false,
          isPreAssigned: false,
          orderIndex: exercises.length + index,
        };

        // Only add if we have at least an ID and name
        if (exercise.id && exercise.name) {
          exercises.push(exercise);
        }
      });
    } else {
    }

    return exercises;
  }, [visualizationData, userId, savedSelections, realtimeExercises]);

  // Progressively enrich exercises with muscle data as it becomes available
  const enrichedClientExercises = useMemo(() => {
    const enriched = clientExercises.map(exercise => {
      // Skip if already has muscle data
      if (exercise.primaryMuscle) return exercise;
      
      // Try to find muscle data from available exercises
      const fullExercise = availableExercises.find(ex => ex.id === exercise.id);
      if (fullExercise?.primaryMuscle) {
        return { ...exercise, primaryMuscle: fullExercise.primaryMuscle };
      }
      
      // Try blueprint candidates
      const blueprintCandidates = visualizationData?.blueprint?.clientExercisePools?.[userId]?.availableCandidates || [];
      const blueprintExercise = blueprintCandidates.find((ex: any) => ex.id === exercise.id);
      if (blueprintExercise?.primaryMuscle) {
        return { ...exercise, primaryMuscle: blueprintExercise.primaryMuscle };
      }
      
      return exercise;
    });

    // Sort by orderIndex to ensure proper display order
    return enriched.sort((a, b) => a.orderIndex - b.orderIndex);
  }, [clientExercises, availableExercises, visualizationData, userId]);

  // Check if exercises have been ordered by Phase 2 LLM
  const exercisesAreOrdered = useMemo(() => {
    // If any exercise has an orderIndex !== 999, then Phase 2 has run
    return enrichedClientExercises.some(ex => ex.orderIndex !== 999);
  }, [enrichedClientExercises]);

  // Get user name and avatar
  const userName = useMemo(() => {
    // First try direct client info response
    if (clientInfoResponse?.user?.userName) {
      return clientInfoResponse.user.userName;
    }

    // Then check visualization data
    if (visualizationData?.groupContext) {
      const client = visualizationData.groupContext.clients.find(
        (c: any) => c.user_id === userId,
      );
      if (client?.name) return client.name;
      if (client?.email) return client.email.split("@")[0];
    }

    // Try email from clientInfoResponse
    if (clientInfoResponse?.user?.userEmail) {
      return clientInfoResponse.user.userEmail.split("@")[0];
    }

    // Final fallback
    return "Client";
  }, [visualizationData, userId, clientInfoResponse]);

  const avatarUrl = `${AVATAR_API_URL}?seed=${encodeURIComponent(userName)}`;


  // Reset states when modals close
  useEffect(() => {
    if (!modalOpen && !showExerciseSelection) {
      setSelectedExercise(null);
      setSelectedExerciseIndex(null);
      setSelectedReplacement(null);
      setSearchQuery("");
      setShowFullExerciseList(false);
      setMuscleSectionCount(3);
      setOtherSectionCount(3);
    }
  }, [modalOpen, showExerciseSelection]);

  // Refetch visualization when we get real-time exercises
  useEffect(() => {
    if (realtimeExercises.length > 0 && !visualizationData) {
      refetchVisualization();
    }
  }, [realtimeExercises.length, visualizationData, refetchVisualization]);

  // Update hasExercises state when exercises are loaded
  useEffect(() => {
    const exercisesLoaded = enrichedClientExercises.length > 0;
    if (exercisesLoaded !== hasExercises) {
      setHasExercises(exercisesLoaded);
    }
  }, [enrichedClientExercises.length, hasExercises]);

  // Initialize ready state from client info
  useEffect(() => {
    if (clientInfoResponse?.status === 'workout_ready' && !isReady) {
      setIsReady(true);
    }
  }, [clientInfoResponse?.status, isReady]);

  // Remove this useEffect - we'll initialize reorderedExercises when clicking the button

  // Handle exercise reordering
  const moveExercise = (fromIndex: number, toIndex: number) => {
    const newExercises = [...reorderedExercises];
    const [removed] = newExercises.splice(fromIndex, 1);
    newExercises.splice(toIndex, 0, removed);
    setReorderedExercises(newExercises);
  };

  // Save new order
  const saveNewOrder = () => {
    const updates = reorderedExercises.map((exercise, index) => ({
      workoutExerciseId: exercise.id,
      newOrderIndex: index
    }));
    
    updateExerciseOrderMutation.mutate({
      sessionId: sessionId!,
      clientId: userId!,
      updates
    });
  };

  // Filter exercises for the selection modal
  const filteredExercises = useMemo(() => {
    if (!showExerciseSelection || !selectedExercise) {
      return [];
    }

    // Get already selected exercise IDs (including the one being replaced)
    const selectedIds = new Set(
      enrichedClientExercises
        .filter((ex, idx) => idx !== selectedExerciseIndex) // Exclude the exercise being replaced
        .map((ex) => ex.id)
    );

    // First filter by template type - only show exercises suitable for standard template
    const templateFiltered = availableExercises.filter((exercise) => {
      // If exercise has no templateType, include it (backwards compatibility)
      if (!exercise.templateType || exercise.templateType.length === 0) {
        return true;
      }
      // Check if exercise is tagged for standard template
      return exercise.templateType.includes('standard');
    });

    // Then filter by search query
    const searchFiltered = searchQuery.trim()
      ? filterExercisesBySearch(templateFiltered, searchQuery)
      : templateFiltered;

    // Finally remove already selected exercises
    return searchFiltered.filter((exercise) => !selectedIds.has(exercise.id));
  }, [
    availableExercises,
    searchQuery,
    showExerciseSelection,
    selectedExercise,
    enrichedClientExercises,
  ]);

  // Group filtered exercises by muscle
  const groupedExercises = useMemo(() => {
    const groups: Array<[string, any[]]> = [];
    
    // Add favorites as the first group if any exist
    if (favoriteExercises.length > 0 && !searchQuery.trim()) {
      // Get already selected exercise IDs (excluding the one being replaced)
      const selectedIds = new Set(
        enrichedClientExercises
          .filter((ex, idx) => idx !== selectedExerciseIndex)
          .map((ex) => ex.id)
      );
      
      // Filter favorites to exclude already selected ones and the one being replaced
      const filteredFavorites = favoriteExercises.filter((fav: any) => 
        !selectedIds.has(fav.id) && fav.id !== selectedExercise?.id
      );
      
      if (filteredFavorites.length > 0) {
        groups.push(['Favorites', filteredFavorites]);
      }
    }
    
    // Add regular muscle groups
    const muscleGroups = groupByMuscle(filteredExercises);
    groups.push(...muscleGroups);
    
    return groups;
  }, [filteredExercises, favoriteExercises, searchQuery, enrichedClientExercises, selectedExerciseIndex, selectedExercise]);

  // Memoize muscle candidates for recommendations
  const muscleCandidates = useMemo(() => {
    if (!selectedExercise) return [];
    
    const targetMuscle = selectedExercise?.primaryMuscle;
    const unifiedMuscle = getUnifiedMuscleGroup(targetMuscle);
    
    // Get already selected exercise IDs to filter out (excluding the one being replaced)
    const selectedExerciseIds = new Set(
      enrichedClientExercises
        .filter((ex, idx) => idx !== selectedExerciseIndex)
        .map(ex => ex.id)
    );
    
    // Get blueprint candidates from visualization data (no fallback)
    const blueprintCandidates = visualizationData?.blueprint?.clientExercisePools?.[userId]?.availableCandidates || [];
    const candidatesPool = blueprintCandidates;
    
    // Filter candidates:
    // 1. Match the target muscle group (primary muscle only)
    // 2. Not already in workout selection
    // 3. Not the current exercise being replaced
    const eligible = candidatesPool
      .filter((candidate: any) => {
        const candidateMuscle = getUnifiedMuscleGroup(candidate.primaryMuscle);
        const isCorrectMuscle = candidateMuscle === unifiedMuscle;
        const notAlreadySelected = !selectedExerciseIds.has(candidate.id);
        const notCurrentExercise = candidate.id !== selectedExercise?.id;
        return isCorrectMuscle && notAlreadySelected && notCurrentExercise;
      })
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
    
    // Use tie-breaking to get a consistent order
    return selectTopWithTieBreaking(eligible, eligible.length);
  }, [enrichedClientExercises, selectedExerciseIndex, selectedExercise, visualizationData, userId, availableExercises]);

  // Memoize other options candidates
  const otherCandidates = useMemo(() => {
    if (!selectedExercise) return [];
    
    const targetMuscle = selectedExercise?.primaryMuscle;
    const unifiedMuscle = getUnifiedMuscleGroup(targetMuscle);
    // workoutType is now stored per-client in the groupContext.clients array
    const currentClient = visualizationData?.groupContext?.clients?.find((c: any) => c.user_id === userId);
    const workoutType = currentClient?.workoutType;
    // Check if it's any of the 3 full body variants
    const isFullBodyWorkout = workoutType?.toLowerCase().includes('full_body') || false;
    const showAllHighScoring = unifiedMuscle === "Other";
    
    console.log("[Other Options Debug] Workout type:", workoutType, "isFullBody:", isFullBodyWorkout);
    
    // Get already selected exercise IDs to filter out (excluding the one being replaced)
    const selectedExerciseIds = new Set(
      enrichedClientExercises
        .filter((ex, idx) => idx !== selectedExerciseIndex)
        .map(ex => ex.id)
    );
    
    // Get blueprint candidates from visualization data (no fallback)
    const blueprintCandidates = visualizationData?.blueprint?.clientExercisePools?.[userId]?.availableCandidates || [];
    const candidatesPool = blueprintCandidates;
    
    if (isFullBodyWorkout) {
      // For full body workouts: Get the highest scored exercise for each muscle not in workout
      
      // First, get all muscle groups currently in the workout
      const musclesInWorkout = new Set<string>();
      enrichedClientExercises.forEach((ex, idx) => {
        if (idx !== selectedExerciseIndex && ex.primaryMuscle) {
          const muscle = getUnifiedMuscleGroup(ex.primaryMuscle);
          musclesInWorkout.add(muscle);
        }
      });
      
      
      // Group candidates by muscle
      const exercisesByMuscle = new Map<string, any[]>();
      candidatesPool.forEach((ex: any) => {
        // Exclude already selected exercises and the current exercise
        if (selectedExerciseIds.has(ex.id) || ex.id === selectedExercise?.id) return;
        
        const muscle = getUnifiedMuscleGroup(ex.primaryMuscle);
        if (!exercisesByMuscle.has(muscle)) {
          exercisesByMuscle.set(muscle, []);
        }
        exercisesByMuscle.get(muscle)!.push(ex);
      });
      
      
      // Sort exercises within each muscle by score
      exercisesByMuscle.forEach((exercises, muscle) => {
        exercises.sort((a, b) => (b.score || 0) - (a.score || 0));
      });
      
      // Get the top exercise from each muscle not in workout
      const topExercisesByMuscle: Array<{muscle: string, exercise: any}> = [];
      exercisesByMuscle.forEach((exercises, muscle) => {
        if (!musclesInWorkout.has(muscle) && exercises.length > 0) {
          topExercisesByMuscle.push({
            muscle,
            exercise: exercises[0] // Top scored exercise for this muscle
          });
        }
      });
      
      
      // Sort by exercise score to get the highest scoring exercises across all muscles
      topExercisesByMuscle.sort((a, b) => (b.exercise.score || 0) - (a.exercise.score || 0));
      
      // Store the primary candidates from uncovered muscles
      const primaryCandidates = topExercisesByMuscle.map(item => item.exercise);
      
      
      // Get all other exercises as fallback
      const fallbackCandidates = candidatesPool
        .filter((ex: any) => 
          !selectedExerciseIds.has(ex.id) && 
          ex.id !== selectedExercise?.id &&
          !primaryCandidates.some(pc => pc.id === ex.id)
        )
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      
      
      // For Other Options, we want to show only 1 exercise per muscle
      // Start with primary candidates (from muscles not in workout)
      const finalCandidates: any[] = [];
      const usedMuscles = new Set<string>();
      
      // Add primary candidates first (these are already 1 per muscle)
      primaryCandidates.forEach(exercise => {
        const muscle = getUnifiedMuscleGroup(exercise.primaryMuscle);
        finalCandidates.push(exercise);
        usedMuscles.add(muscle);
      });
      
      // If we need more to reach 3, add from fallback but only 1 per muscle
      if (finalCandidates.length < 3) {
        for (const exercise of fallbackCandidates) {
          const muscle = getUnifiedMuscleGroup(exercise.primaryMuscle);
          if (!usedMuscles.has(muscle)) {
            finalCandidates.push(exercise);
            usedMuscles.add(muscle);
            if (finalCandidates.length >= 3) break;
          }
        }
      }
      
      
      // Use tie-breaking to get consistent order
      return selectTopWithTieBreaking(finalCandidates, finalCandidates.length);
    } else {
      // Targeted workout logic - show exercises from OTHER target muscles
      const clientTargetMuscles = visualizationData?.groupContext?.clients?.find((c: any) => c.user_id === userId)?.muscle_target || [];
      
      // If client has muscle targets, show exercises from other target muscles
      if (clientTargetMuscles.length > 0) {
        // Get other target muscles (excluding the muscle being replaced)
        const otherTargetMuscles = clientTargetMuscles.filter((muscle: string) => {
          const unifiedTargetMuscle = getUnifiedMuscleGroup(muscle);
          return unifiedTargetMuscle !== unifiedMuscle;
        });
        
        console.log("[Other Options Debug] Other target muscles:", otherTargetMuscles);
        
        if (otherTargetMuscles.length === 0) {
          // No other target muscles - fall back to showing any high-scoring exercises
          const filtered = candidatesPool
            .filter((ex: any) => 
              !selectedExerciseIds.has(ex.id) && 
              ex.id !== selectedExercise?.id
            )
            .sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
          
          return selectTopWithTieBreaking(filtered.slice(0, 3), 3);
        }
        
        // Get best exercises from each other target muscle
        const exercisesByTargetMuscle = new Map<string, any[]>();
        
        candidatesPool.forEach((ex: any) => {
          // Skip if already selected or is the current exercise
          if (selectedExerciseIds.has(ex.id) || ex.id === selectedExercise?.id) return;
          
          // Check if this exercise's PRIMARY muscle matches any of the other target muscles
          const exUnifiedMuscle = getUnifiedMuscleGroup(ex.primaryMuscle);
          const matchingTarget = otherTargetMuscles.find((target: string) => 
            getUnifiedMuscleGroup(target) === exUnifiedMuscle
          );
          
          if (matchingTarget) {
            const targetKey = getUnifiedMuscleGroup(matchingTarget);
            if (!exercisesByTargetMuscle.has(targetKey)) {
              exercisesByTargetMuscle.set(targetKey, []);
            }
            exercisesByTargetMuscle.get(targetKey)!.push(ex);
          }
        });
        
        // Sort exercises within each muscle by score
        exercisesByTargetMuscle.forEach((exercises, muscle) => {
          exercises.sort((a, b) => (b.score || 0) - (a.score || 0));
          console.log(`[Other Options Debug] ${muscle} exercises found:`, exercises.length, 
            exercises.slice(0, 3).map(ex => ({ name: ex.name, score: ex.score })));
        });
        
        // Build final list based on number of other target muscles
        const finalCandidates: any[] = [];
        
        if (exercisesByTargetMuscle.size === 1) {
          // Only 1 other target muscle - show top 3 from that muscle
          const exercises = Array.from(exercisesByTargetMuscle.values())[0];
          finalCandidates.push(...exercises.slice(0, 3));
        } else if (exercisesByTargetMuscle.size === 2) {
          // 2 other target muscles - ensure at least 1 from each muscle
          const muscleArrays = Array.from(exercisesByTargetMuscle.entries());
          
          // First, get the top exercise from each muscle
          const topFromEach: Array<{muscle: string, exercise: any}> = [];
          muscleArrays.forEach(([muscle, exercises]) => {
            if (exercises.length > 0) {
              topFromEach.push({ muscle, exercise: exercises[0] });
            }
          });
          
          // Add these guaranteed picks
          finalCandidates.push(...topFromEach.map(item => item.exercise));
          
          // For the remaining slot(s), get the next best exercise from either muscle
          if (finalCandidates.length < 3) {
            const remainingCandidates: Array<{muscle: string, exercise: any}> = [];
            
            muscleArrays.forEach(([muscle, exercises]) => {
              // Skip the first exercise since we already added it
              exercises.slice(1).forEach(ex => {
                remainingCandidates.push({ muscle, exercise: ex });
              });
            });
            
            // Sort remaining by score
            remainingCandidates.sort((a, b) => (b.exercise.score || 0) - (a.exercise.score || 0));
            
            // Add the best remaining exercise(s) to reach 3 total
            const slotsNeeded = 3 - finalCandidates.length;
            finalCandidates.push(...remainingCandidates.slice(0, slotsNeeded).map(c => c.exercise));
          }
          
          console.log("[Other Options Debug] Final distribution:", 
            finalCandidates.map(ex => ({ 
              name: ex.name, 
              muscle: ex.primaryMuscle,
              unifiedMuscle: getUnifiedMuscleGroup(ex.primaryMuscle),
              score: ex.score 
            })));
        } else {
          // 3+ other target muscles - show 1 from each (top 3)
          const topFromEachMuscle: any[] = [];
          
          exercisesByTargetMuscle.forEach((exercises) => {
            if (exercises.length > 0) {
              topFromEachMuscle.push(exercises[0]); // Top exercise from this muscle
            }
          });
          
          // Sort by score and take top 3
          topFromEachMuscle.sort((a, b) => (b.score || 0) - (a.score || 0));
          finalCandidates.push(...topFromEachMuscle.slice(0, 3));
        }
        
        return selectTopWithTieBreaking(finalCandidates, finalCandidates.length);
      }
      
      // No muscle targets - use original logic
      const filtered = candidatesPool
        .filter((ex: any) => {
          // Exclude already selected exercises and the current exercise being replaced
          if (selectedExerciseIds.has(ex.id) || ex.id === selectedExercise?.id) return false;
          
          if (showAllHighScoring) return true; // Show all if muscle unknown
          const exMuscle = getUnifiedMuscleGroup(ex.primaryMuscle);
          return exMuscle !== unifiedMuscle;
        })
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      
      // Use tie-breaking to get consistent order
      return selectTopWithTieBreaking(filtered, filtered.length);
    }
  }, [enrichedClientExercises, selectedExerciseIndex, selectedExercise, visualizationData, userId, availableExercises]);

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

  if (!sessionId || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-md">
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="mb-4 text-2xl font-bold text-gray-900">
              Invalid Link
            </h1>
            <p className="text-gray-600">
              The workout link appears to be invalid. Please check with your
              trainer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading your workout...</p>
        </div>
      </div>
    );
  }

  // Empty state when no exercises found
  if (enrichedClientExercises.length === 0 && realtimeExercises.length === 0) {
    // Show "All Set!" state if we're waiting for workout generation
    if (!visualizationData || visualizationData === null) {
      return (
        <div className="min-h-screen bg-gray-50 p-4">
          <div className="mx-auto max-w-md mt-4">
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-lg">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-gray-900">All Set!</h3>
              <p className="mb-4 text-gray-600">
                Your preferences have been saved. Your trainer will start the
                workout soon.
              </p>
              <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-400"></div>
                <span>Waiting for workout generation</span>
              </div>
              <button
                onClick={() => {
                  if (sessionId && userId) {
                    router.push(`/preferences/client/${sessionId}/${userId}`);
                  } else {
                    router.push("/");
                  }
                }}
                className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
              >
                Back to Preferences
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Other error states
    let message = "No exercises found for your workout.";
    let subMessage =
      "The workout was generated but no exercises were assigned. Please contact your trainer.";

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-md">
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="mb-4 text-2xl font-bold text-gray-900">
              Your Workout
            </h1>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-6 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h2 className="mb-2 mt-4 font-semibold text-gray-800">
                  {message}
                </h2>
                <p className="text-gray-600">{subMessage}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-md p-4 pb-20">
        {/* Header with Client info and Muscle History button */}
        <div className="mb-6 mt-4 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src={avatarUrl}
              alt={userName}
              className="mr-3 h-10 w-10 rounded-full"
            />
            <h2 className="text-lg font-semibold text-gray-900">
              {userName}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Muscle History Button */}
            <button
              onClick={() => muscleHistoryModal.open()}
              className="flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-2 text-white shadow-md active:scale-95 transition-all hover:bg-indigo-700"
              aria-label="View Muscle History"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium">Targets to Hit</span>
            </button>
          </div>
        </div>

        {/* Order Status Indicator */}
        {!exercisesAreOrdered && enrichedClientExercises.length > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="flex h-2 w-2 animate-pulse rounded-full bg-amber-400"></div>
            <p className="text-sm text-amber-800">
              <span className="font-medium">Finalizing workout order...</span>
              <span className="ml-1 text-amber-600">Your exercises will be numbered shortly</span>
            </p>
          </div>
        )}

        {/* Client Card */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {/* Exercise list header */}
          {exercisesAreOrdered && (
            <div className="border-b border-gray-100 px-4 py-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Your Workout Order</p>
                <span className="text-xs text-gray-500">Follow exercises in sequence</span>
              </div>
            </div>
          )}
          
          {/* Exercise list */}
          <div className="p-4">
            <div className="space-y-4">
              {(isReorderMode ? reorderedExercises : enrichedClientExercises).map((exercise, index) => {
                const muscleGroup = getUnifiedMuscleGroup(exercise.primaryMuscle);
                const displayOrder = exercisesAreOrdered ? index + 1 : null;
                
                return (
                  <div key={exercise.id} className={`group flex items-start gap-3 ${exercisesAreOrdered ? 'relative' : ''}`}>
                    {/* Exercise Order Number */}
                    {exercisesAreOrdered && (
                      <div className="flex-shrink-0 flex items-center justify-center">
                        <div className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                          index === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                        } font-semibold text-sm transition-all group-hover:scale-110`}>
                          {displayOrder}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-base font-medium text-gray-800 ${exercisesAreOrdered && index === 0 ? 'text-indigo-700' : ''}`}>
                            {exercise.name}
                          </span>
                          {exercise.primaryMuscle ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              muscleGroup === 'Chest' ? 'bg-yellow-50 text-yellow-700'
                              : muscleGroup === 'Back' ? 'bg-green-50 text-green-700'
                              : muscleGroup === 'Shoulders' ? 'bg-purple-50 text-purple-700'
                              : muscleGroup === 'Core' ? 'bg-orange-50 text-orange-700'
                              : muscleGroup === 'Glutes' ? 'bg-red-50 text-red-700'
                              : muscleGroup === 'Quads' || muscleGroup === 'Hamstrings' ? 'bg-pink-50 text-pink-700'
                              : muscleGroup === 'Biceps' || muscleGroup === 'Triceps' ? 'bg-blue-50 text-blue-700'
                              : muscleGroup === 'Calves' ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-gray-50 text-gray-600'
                            }`}>
                              {muscleGroup}
                            </span>
                          ) : isLoadingExercises ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100">
                              <div className="h-2 w-2 animate-pulse rounded-full bg-gray-400"></div>
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {isReorderMode ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveExercise(index, Math.max(0, index - 1))}
                            disabled={index === 0}
                            className={`p-1 rounded ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                            aria-label="Move up"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveExercise(index, Math.min(reorderedExercises.length - 1, index + 1))}
                            disabled={index === reorderedExercises.length - 1}
                            className={`p-1 rounded ${index === reorderedExercises.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                            aria-label="Move down"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            // Use the enriched exercise which already has muscle data if available
                            setSelectedExercise(exercise);
                            setSelectedExerciseIndex(index);
                            // Skip the modal and go directly to exercise selection
                            setShowExerciseSelection(true);
                          }}
                          disabled={!visualizationData?.blueprint?.clientExercisePools?.[userId]?.availableCandidates}
                          className={`flex-shrink-0 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                            !visualizationData?.blueprint?.clientExercisePools?.[userId]?.availableCandidates
                              ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          aria-label="Replace exercise"
                        >
                          {!visualizationData?.blueprint?.clientExercisePools?.[userId]?.availableCandidates ? (
                            <span className="flex items-center gap-1.5">
                              <SpinnerIcon className="h-3 w-3 animate-spin" />
                              Loading
                            </span>
                          ) : (
                            "Replace"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* TEMPORARY: Display all available exercises */}
        {showExerciseSelection && availableExercises.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <p className="font-bold mb-2">All Available Exercises in Database (TEMP):</p>
            <div className="max-h-40 overflow-y-auto">
              {availableExercises
                .slice(0, 30) // Show first 30
                .map((exercise: any, index: number) => (
                  <div key={exercise.id} className="py-0.5">
                    <span className="font-medium">{exercise.name}</span>
                    <span className="ml-2 text-gray-600">
                      {exercise.primaryMuscle} | {exercise.movementPattern}
                    </span>
                  </div>
                ))}
            </div>
            <p className="mt-2 text-gray-500">Showing first 30 of {availableExercises.length} exercises</p>
          </div>
        )}

        {/* Ready Button / Reorder Controls */}
        <div className="mt-6">
          {exercisesAreOrdered ? (
            /* Show reorder controls when exercises are ordered */
            isReorderMode ? (
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => {
                    setIsReorderMode(false);
                    setReorderedExercises([]);
                  }}
                  className="px-6 py-3 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNewOrder}
                  disabled={updateExerciseOrderMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-white font-medium active:scale-95 transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateExerciseOrderMutation.isPending ? (
                    <>
                      <SpinnerIcon className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Order</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setReorderedExercises([...enrichedClientExercises]);
                  setIsReorderMode(true);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-600 py-3 text-white font-medium active:scale-95 transition-all hover:bg-gray-700"
                aria-label="Reorder Exercises"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span>Reorder Exercises</span>
              </button>
            )
          ) : (
            /* Show ready button when exercises are not ordered yet */
            isReady ? (
              <div className="w-full rounded-lg bg-green-100 border border-green-300 py-3 text-center">
                <span className="text-green-800 font-medium">✓ You're Ready!</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  updateStatusMutation.mutate({
                    sessionId: sessionId!,
                    userId: userId!,
                    isReady: true,
                    targetStatus: 'workout_ready'
                  });
                }}
                disabled={updateStatusMutation.isPending}
                className={`w-full rounded-lg py-3 font-medium transition-colors ${
                  updateStatusMutation.isPending
                    ? "bg-gray-300 text-gray-500"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {updateStatusMutation.isPending ? "Updating..." : "Ready"}
              </button>
            )
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
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto flex h-[85vh] max-w-lg -translate-y-1/2 flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Change Exercise
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Replacing: <span className="font-medium text-gray-900">{selectedExercise?.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowExerciseSelection(false);
                    setSelectedReplacement(null);
                  }}
                  className="rounded-full p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 hover:rotate-90"
                >
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto" ref={modalContentRef}>
              {/* Two-stage view */}
              {!showFullExerciseList ? (
                /* Stage 1: Recommended Alternatives */
                <div className="p-6">
                  {/* Loading state */}
                  {(isLoadingExercises || isLoading) && (
                    <div className="py-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-full mb-4">
                        <SpinnerIcon className="h-8 w-8 animate-spin text-indigo-600" />
                      </div>
                      <p className="text-gray-500 font-medium">Loading recommendations...</p>
                    </div>
                  )}


                  {/* Recommended exercises list */}
                  {!isLoadingExercises && !isLoading && (
                    <>
                      {/* Primary Recommendations - Same muscle group */}
                      {(() => {
                        // Get the muscle group of the exercise being replaced
                        const targetMuscle = selectedExercise?.primaryMuscle;
                        const unifiedMuscle = getUnifiedMuscleGroup(targetMuscle);
                        
                        // If muscle is "Other", it means we don't have muscle data yet
                        if (unifiedMuscle === "Other" && isLoadingExercises) {
                          return (
                            <div className="flex items-center justify-center py-8">
                              <div className="text-center">
                                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                                <p className="mt-2 text-sm text-gray-600">Loading recommendations...</p>
                              </div>
                            </div>
                          );
                        }
                        
                        // Get exercises based on current count
                        const recommendedExercises = muscleCandidates.slice(0, muscleSectionCount);
                        
                        // If no blueprint candidates available, show a message
                        if (!visualizationData?.blueprint?.clientExercisePools?.[userId]?.availableCandidates) {
                          return (
                            <div className="py-8 text-center">
                              <p className="text-gray-500">Loading exercise recommendations...</p>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="mb-8">
                            <div className="mb-4">
                              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                                {unifiedMuscle} Exercises
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {recommendedExercises.map((exercise: any, index: number) => {
                                // Blueprint candidates are already full exercise objects
                                const actualExercise = exercise;
                                
                                if (!actualExercise || !actualExercise.id) return null;

                                return (
                                  <button
                                    key={actualExercise.id}
                                    onClick={() => setSelectedReplacement(actualExercise.name)}
                                    className={`group flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all ${
                                      selectedReplacement === actualExercise.name
                                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                                        : 'bg-white hover:bg-gray-50 shadow-sm hover:shadow-md border border-gray-100'
                                    }`}
                                  >
                                    <div className="flex-1">
                                      <p className={`font-medium ${
                                        selectedReplacement === actualExercise.name
                                          ? 'text-white'
                                          : 'text-gray-900'
                                      }`}>
                                        {actualExercise.name}
                                      </p>
                                    </div>
                                    {actualExercise.primaryMuscle && (
                                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                                        selectedReplacement === actualExercise.name
                                          ? 'bg-white/20 text-white'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {actualExercise.primaryMuscle.toLowerCase().replace(/_/g, ' ')}
                                      </span>
                                    )}
                                  </button>
                                );
                              }).filter(Boolean)}
                              
                              {recommendedExercises.length === 0 && (
                                <p className="text-sm text-gray-500 italic">
                                  No {unifiedMuscle.toLowerCase()} exercises available
                                </p>
                              )}
                            </div>
                            
                            {/* See more button */}
                            {muscleCandidates.length > muscleSectionCount && (
                              <div className="mt-3 flex justify-center">
                                <button
                                  onClick={() => {
                                    setMuscleSectionCount(prev => prev + 4);
                                  }}
                                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
                                >
                                  <span>See more</span>
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Other Recommendations */}
                      {(() => {
                        // Get exercises based on current count
                        const otherMuscleExercises = otherCandidates.slice(0, otherSectionCount);
                        
                        
                        if (otherMuscleExercises.length === 0) return null;
                        
                        return (
                          <div className="mb-6">
                            <div className="mb-4">
                              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                                Other Options
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {otherMuscleExercises.map((exercise: any, index: number) => {
                                // Blueprint candidates are already full exercise objects
                                const actualExercise = exercise;
                                
                                if (!actualExercise || !actualExercise.id) return null;
                                
                                const muscleGroup = getUnifiedMuscleGroup(actualExercise.primaryMuscle);

                                return (
                                  <button
                                    key={actualExercise.id}
                                    onClick={() => setSelectedReplacement(actualExercise.name)}
                                    className={`group flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all ${
                                      selectedReplacement === actualExercise.name
                                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                                        : 'bg-white hover:bg-gray-50 shadow-sm hover:shadow-md border border-gray-100'
                                    }`}
                                  >
                                    <div className="flex-1">
                                      <p className={`font-medium ${
                                        selectedReplacement === actualExercise.name
                                          ? 'text-white'
                                          : 'text-gray-900'
                                      }`}>
                                        {actualExercise.name}
                                      </p>
                                    </div>
                                    {actualExercise.primaryMuscle && (
                                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                                        selectedReplacement === actualExercise.name
                                          ? 'bg-white/20 text-white'
                                          : muscleGroup === 'Chest' ? 'bg-yellow-100 text-yellow-800'
                                          : muscleGroup === 'Back' ? 'bg-green-100 text-green-800'
                                          : muscleGroup === 'Shoulders' ? 'bg-purple-100 text-purple-800'
                                          : muscleGroup === 'Core' ? 'bg-orange-100 text-orange-800'
                                          : muscleGroup === 'Glutes' || muscleGroup === 'Quads' || muscleGroup === 'Hamstrings' ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {actualExercise.primaryMuscle.toLowerCase().replace(/_/g, ' ')}
                                      </span>
                                    )}
                                  </button>
                                );
                              }).filter(Boolean)}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Show all exercises button */}
                      <div className="border-t border-gray-100 pt-6 mt-8">
                        <button
                          onClick={() => {
                            setShowFullExerciseList(true);
                            // Scroll to top of modal content
                            if (modalContentRef.current) {
                              modalContentRef.current.scrollTop = 0;
                            }
                          }}
                          className="w-full rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3.5 text-center font-medium text-gray-700 transition-all hover:from-gray-100 hover:to-gray-200 hover:shadow-md group"
                        >
                          <span className="flex items-center justify-center gap-2">
                            Browse All Exercises
                            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Stage 2: Full Exercise List */
                <>
                  {/* Search Bar */}
                  <div className="sticky top-0 z-10 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50 px-6 py-5">
                    <div className="mb-4 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setShowFullExerciseList(false);
                          setSearchQuery("");
                        }}
                        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors group"
                      >
                        <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to recommendations
                      </button>
                    </div>
                    <div className="relative">
                      <SearchIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search exercises..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={isLoadingExercises}
                        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100 disabled:text-gray-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="p-6">
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

                    {/* All exercises - flat list when searching, grouped when browsing */}
                    {!isLoadingExercises && filteredExercises.length > 0 && (
                      <div className="space-y-3">
                        {searchQuery.trim() ? (
                          // Flat list when searching
                          <div className="space-y-2">
                            {(() => {
                              // When searching, create a deduped list with favorites shown first
                              const seenIds = new Set<string>();
                              const deduplicatedExercises: any[] = [];
                              
                              // Add matching favorites first
                              const matchingFavorites = filterExercisesBySearch(favoriteExercises, searchQuery);
                              matchingFavorites.forEach(fav => {
                                if (!seenIds.has(fav.id)) {
                                  seenIds.add(fav.id);
                                  deduplicatedExercises.push({...fav, isFavorite: true});
                                }
                              });
                              
                              // Then add regular filtered exercises (skipping duplicates)
                              filteredExercises.forEach(exercise => {
                                if (!seenIds.has(exercise.id)) {
                                  seenIds.add(exercise.id);
                                  deduplicatedExercises.push(exercise);
                                }
                              });
                              
                              return deduplicatedExercises.map((exercise: any) => {
                                const muscleGroup = getUnifiedMuscleGroup(exercise.primaryMuscle);
                                
                                return (
                                  <button
                                    key={exercise.id}
                                    onClick={() => setSelectedReplacement(exercise.name)}
                                    className={`group flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all ${
                                      selectedReplacement === exercise.name
                                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                                        : 'bg-white hover:bg-gray-50 shadow-sm hover:shadow-md border border-gray-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`font-medium ${
                                        selectedReplacement === exercise.name
                                          ? 'text-white'
                                          : 'text-gray-900'
                                      }`}>
                                        {exercise.name}
                                      </span>
                                      {exercise.isFavorite && (
                                        <span className={`text-xs ${
                                          selectedReplacement === exercise.name
                                            ? 'text-white/80'
                                            : 'text-yellow-600'
                                        }`}>
                                          ⭐
                                        </span>
                                      )}
                                    </div>
                                    {exercise.primaryMuscle && (
                                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                                        selectedReplacement === exercise.name
                                          ? 'bg-white/20 text-white'
                                          : muscleGroup === 'Chest' ? 'bg-yellow-100 text-yellow-800'
                                          : muscleGroup === 'Back' ? 'bg-green-100 text-green-800'
                                          : muscleGroup === 'Shoulders' ? 'bg-purple-100 text-purple-800'
                                          : muscleGroup === 'Core' ? 'bg-orange-100 text-orange-800'
                                          : muscleGroup === 'Glutes' || muscleGroup === 'Quads' || muscleGroup === 'Hamstrings' ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {exercise.primaryMuscle.toLowerCase().replace(/_/g, ' ')}
                                      </span>
                                    )}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        ) : (
                          // Grouped by muscle when browsing
                          groupedExercises.map(([muscle, exercises]) => (
                          <div key={muscle} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                            {/* Muscle group header */}
                            <button
                              onClick={() => toggleMuscleGroup(muscle)}
                              className="flex w-full items-center justify-between px-5 py-4 text-left transition-all hover:bg-gray-50"
                            >
                              <span className="flex items-center gap-2 font-semibold text-gray-900">
                                <span className="capitalize">
                                  {muscle.toLowerCase().replace(/_/g, ' ')}
                                </span>
                                {muscle === 'Favorites' && (
                                  <span className="text-yellow-500">⭐</span>
                                )}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                  {exercises.length}
                                </span>
                                <svg
                                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
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
                              <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                                <div className="space-y-1.5">
                                  {exercises.map((exercise: any) => (
                                    <button
                                      key={exercise.id}
                                      onClick={() => setSelectedReplacement(exercise.name)}
                                      className={`flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-left transition-all ${
                                        selectedReplacement === exercise.name
                                          ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md scale-[1.02]'
                                          : 'bg-white hover:bg-gray-50 hover:shadow-sm'
                                      }`}
                                    >
                                      <span className={`font-medium ${
                                        selectedReplacement === exercise.name
                                          ? 'text-white'
                                          : 'text-gray-900'
                                      }`}>
                                        {exercise.name}
                                      </span>
                                      {exercise.primaryMuscle && (
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                                          selectedReplacement === exercise.name
                                            ? 'bg-white/20 text-white'
                                            : (() => {
                                                const muscleGroup = getUnifiedMuscleGroup(exercise.primaryMuscle);
                                                return muscleGroup === 'Chest' ? 'bg-yellow-100 text-yellow-800'
                                                  : muscleGroup === 'Back' ? 'bg-green-100 text-green-800'
                                                  : muscleGroup === 'Shoulders' ? 'bg-purple-100 text-purple-800'
                                                  : muscleGroup === 'Core' ? 'bg-orange-100 text-orange-800'
                                                  : muscleGroup === 'Glutes' || muscleGroup === 'Quads' || muscleGroup === 'Hamstrings' ? 'bg-red-100 text-red-800'
                                                  : 'bg-gray-100 text-gray-600';
                                              })()
                                        }`}>
                                          {exercise.primaryMuscle.toLowerCase().replace(/_/g, ' ')}
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                        )}
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
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 justify-end gap-3 border-t border-gray-100 bg-gradient-to-b from-gray-50 to-white px-6 py-5">
              <button
                onClick={() => {
                  setShowExerciseSelection(false);
                  setSelectedReplacement(null);
                }}
                className="px-5 py-2.5 text-gray-700 font-medium transition-all hover:text-gray-900 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedReplacement || selectedExerciseIndex === null)
                    return;

                  // Find the replacement exercise details
                  const replacementExercise = availableExercises.find(
                    (ex) => ex.name === selectedReplacement,
                  );
                  if (!replacementExercise) return;

                  // Call the public swap endpoint
                  swapExerciseMutation.mutate({
                    sessionId: sessionId!,
                    clientId: userId!,
                    originalExerciseId: selectedExercise.id,
                    newExerciseId: replacementExercise.id,
                    reason: "Client manual selection",
                  });
                }}
                disabled={
                  !selectedReplacement || swapExerciseMutation.isPending
                }
                className={`flex items-center gap-2 rounded-xl px-6 py-2.5 font-medium transition-all ${
                  selectedReplacement && !swapExerciseMutation.isPending
                    ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/25"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                {swapExerciseMutation.isPending ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  "Confirm Change"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Muscle History Modal */}
      <MuscleHistoryModal
        isOpen={muscleHistoryModal.isOpen}
        onClose={muscleHistoryModal.close}
        clientName={userName}
        clientId={userId || ''}
        api={trpc}
      />
    </div>
  );
}

export default function ClientWorkoutOverview() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <ClientWorkoutOverviewContent />
    </Suspense>
  );
}
