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
  XIcon,
} from "@acme/ui-shared";

import { supabase } from "~/lib/supabase";
import { useTRPC } from "~/trpc/react";

const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

interface SelectedExercise {
  exerciseId: string;
  exerciseName: string;
  reasoning: string;
  isShared: boolean;
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

  // Mutation to update client status to workout_ready
  const updateStatusMutation = useMutation({
    ...trpc.trainingSession.updateClientReadyStatusPublic.mutationOptions({
      onSuccess: (data) => {
        console.log('[ClientWorkoutOverview] Status updated to:', data.newStatus);
        // Stay on this page when status is workout_ready
      },
      onError: (error) => {
        console.error("Failed to update status:", error);
        alert("Failed to update status. Please try again.");
      },
    }),
  });

  // Use real-time workout exercises
  useRealtimeWorkoutExercises({
    sessionId: sessionId || "",
    userId: userId || "",
    supabase,
    onExercisesUpdate: (exercises) => {
      console.log(
        "[ClientWorkoutOverview] Received real-time exercises:",
        exercises,
      );
      setRealtimeExercises(exercises);
      // Force refetch of visualization data when exercises arrive
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
      console.log("[ClientWorkoutOverview] Exercise swap detected:", swap);

      // Force refetch of exercise selections and visualization data
      queryClient.invalidateQueries({
        queryKey: [["workoutSelections", "getSelectionsPublic"]],
      });
      queryClient.invalidateQueries({
        queryKey: [["trainingSession", "getSavedVisualizationDataPublic"]],
      });
    },
    onError: (error) => {
      console.error("[ClientWorkoutOverview] Swap updates error:", error);
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
    // Poll every 5s when no exercises are loaded yet
    refetchInterval: !hasExercises ? 5000 : false,
  });

  // Debug visualization data
  console.log("Visualization query result:", {
    data: visualizationData,
    isLoading,
    error: visualizationError,
    sessionId,
    userId,
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
    // Poll every 5s when no exercises are loaded yet
    refetchInterval: !hasExercises ? 5000 : false,
  });

  console.log("Saved selections:", savedSelections);

  // Fetch available exercises
  const { data: exercisesData, isLoading: isLoadingExercises } = useQuery({
    ...trpc.exercise.getAvailablePublic.queryOptions({
      sessionId: sessionId || "",
      userId: userId || "",
    }),
    enabled: !!sessionId && !!userId && showExerciseSelection,
  });

  const availableExercises = exercisesData?.exercises || [];

  // Keep ref updated with available exercises
  useEffect(() => {
    availableExercisesRef.current = availableExercises;
  }, [availableExercises]);

  // Extract exercises for this specific client
  const clientExercises = useMemo(() => {
    // First check if we have real-time exercises
    if (realtimeExercises.length > 0) {
      console.log("Using real-time exercises");
      return realtimeExercises.map((exercise, index) => ({
        id: exercise.exerciseId,
        name: exercise.exerciseName || exercise.name,
        source: "llm_phase1",
        reasoning: "Selected by AI",
        isShared: exercise.isShared || false,
        isPreAssigned: false,
        orderIndex: exercise.orderIndex || index,
      }));
    }

    // Then try to use saved selections (source of truth after swaps)
    if (savedSelections && savedSelections.length > 0) {
      console.log("Using saved selections as primary source");
      return savedSelections.map((selection: any, index: number) => ({
        id: selection.exerciseId,
        name: selection.exerciseName,
        source: selection.selectionSource,
        reasoning:
          selection.selectionSource === "manual_swap"
            ? "Manually selected by client"
            : "Selected by AI",
        isShared: selection.isShared || false,
        isPreAssigned: selection.selectionSource === "pre_assigned",
        orderIndex: index,
      }));
    }

    // Fall back to visualization data if no saved selections
    if (!visualizationData || !userId) return [];

    const llmResult = visualizationData.llmResult;
    const groupContext = visualizationData.groupContext;

    if (!llmResult || !groupContext) {
      console.log("Missing llmResult or groupContext:", {
        llmResult,
        groupContext,
      });
      return [];
    }

    // Debug logging
    console.log("Full Visualization data:", visualizationData);
    console.log("LLM Result:", llmResult);
    console.log("Looking for userId:", userId);

    // Find the client's information
    const clientIndex = groupContext.clients.findIndex(
      (c: any) => c.user_id === userId,
    );
    if (clientIndex === -1) {
      console.log(
        "Client not found in groupContext. Available clients:",
        groupContext.clients,
      );
      return [];
    }

    const client = groupContext.clients[clientIndex];
    const exercises: any[] = [];

    // Get pre-assigned exercises from the blueprint
    const blueprint = visualizationData.blueprint;
    console.log("Blueprint:", blueprint);
    console.log("Client exercise pools:", blueprint?.clientExercisePools);

    if (blueprint?.clientExercisePools?.[userId]) {
      const preAssigned =
        blueprint.clientExercisePools[userId].preAssigned || [];
      console.log("Pre-assigned exercises:", preAssigned);
      preAssigned.forEach((pa: any, index: number) => {
        exercises.push({
          id: pa.exercise.id,
          name: pa.exercise.name,
          source: pa.source,
          reasoning: `Pre-assigned from ${pa.source.toLowerCase()}`,
          isPreAssigned: true,
          orderIndex: index,
        });
      });
    } else {
      console.log("No client exercise pool found for userId:", userId);
    }

    // Get LLM selected exercises
    console.log("Checking for LLM selections at:", {
      path1: llmResult.exerciseSelection?.clientSelections?.[userId],
      path2: llmResult.llmAssignments,
      hasExerciseSelection: !!llmResult.exerciseSelection,
      hasClientSelections: !!llmResult.exerciseSelection?.clientSelections,
      clientIds: llmResult.exerciseSelection?.clientSelections
        ? Object.keys(llmResult.exerciseSelection.clientSelections)
        : [],
      actualUserId: userId,
      clientsInContext: groupContext.clients.map((c: any) => ({
        user_id: c.user_id,
        name: c.name,
      })),
    });

    // Check multiple possible paths for the LLM selections
    let llmSelections = null;

    // First, check if exerciseSelection is a string that needs parsing
    let exerciseSelection = llmResult.exerciseSelection;
    if (typeof exerciseSelection === "string") {
      try {
        exerciseSelection = JSON.parse(exerciseSelection);
        console.log("Parsed exerciseSelection from string");
      } catch (e) {
        console.log("Failed to parse exerciseSelection string");
      }
    }

    // Path 1: exerciseSelection.clientSelections
    if (exerciseSelection?.clientSelections?.[userId]) {
      // The structure uses 'selected' not 'selectedExercises'
      llmSelections =
        exerciseSelection.clientSelections[userId].selected ||
        exerciseSelection.clientSelections[userId].selectedExercises;
      console.log("Found in exerciseSelection.clientSelections");
    }
    // Path 2: Direct clientSelections
    else if (llmResult.clientSelections?.[userId]) {
      llmSelections =
        llmResult.clientSelections[userId].selected ||
        llmResult.clientSelections[userId].selectedExercises;
      console.log("Found in llmResult.clientSelections");
    }
    // Path 3: Check if we need to use client index instead of userId
    else if (exerciseSelection?.clientSelections) {
      // Try using the client index from groupContext
      const clientKey = `client_${clientIndex}`;
      if (exerciseSelection.clientSelections[clientKey]) {
        console.log("Found selections using client key:", clientKey);
        llmSelections =
          exerciseSelection.clientSelections[clientKey].selectedExercises;
      }
    }
    // Path 4: llmAssignments for BMF templates
    else if (llmResult.llmAssignments) {
      // Look for user in llmAssignments structure
      console.log("Checking llmAssignments structure");
    }

    if (llmSelections) {
      console.log("Found LLM selections:", llmSelections);
      llmSelections.forEach((ex: any, index: number) => {
        // Handle different possible structures
        const exercise = {
          id: ex.exerciseId || ex.id,
          name: ex.exerciseName || ex.name,
          reasoning: ex.reasoning || "",
          isShared: ex.isShared || false,
          isPreAssigned: false,
          orderIndex: exercises.length + index,
        };

        // Only add if we have at least an ID and name
        if (exercise.id && exercise.name) {
          exercises.push(exercise);
        }
      });
      console.log(
        "Added exercises from LLM:",
        exercises.length -
          (blueprint?.clientExercisePools?.[userId]?.preAssigned?.length || 0),
      );
    } else {
      console.log("No LLM selections found for user");
    }

    return exercises;
  }, [visualizationData, userId, savedSelections, realtimeExercises]);

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
    }
  }, [modalOpen, showExerciseSelection]);

  // Refetch visualization when we get real-time exercises
  useEffect(() => {
    if (realtimeExercises.length > 0 && !visualizationData) {
      console.log(
        "[ClientWorkoutOverview] Real-time exercises detected, refetching visualization data",
      );
      refetchVisualization();
    }
  }, [realtimeExercises.length, visualizationData, refetchVisualization]);

  // Update hasExercises state when exercises are loaded
  useEffect(() => {
    const exercisesLoaded = clientExercises.length > 0;
    if (exercisesLoaded !== hasExercises) {
      console.log("[ClientWorkoutOverview] Exercises loaded state changed:", exercisesLoaded);
      setHasExercises(exercisesLoaded);
    }
  }, [clientExercises.length, hasExercises]);

  // Filter exercises for the selection modal
  const filteredExercises = useMemo(() => {
    if (!showExerciseSelection || !selectedExercise) {
      return [];
    }

    // Get already selected exercise IDs
    const selectedIds = new Set(clientExercises.map((ex) => ex.id));

    // Filter available exercises based on search
    const filtered = searchQuery.trim()
      ? filterExercisesBySearch(availableExercises, searchQuery)
      : availableExercises;

    // Remove already selected exercises
    return filtered.filter((exercise) => !selectedIds.has(exercise.id));
  }, [
    availableExercises,
    searchQuery,
    showExerciseSelection,
    selectedExercise,
    clientExercises,
  ]);

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
  if (clientExercises.length === 0 && realtimeExercises.length === 0) {
    // Show "All Set!" state if we're waiting for workout generation
    if (!visualizationData || visualizationData === null) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-lg">
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
              <div className="h-2 w-2 animate-pulse rounded-full bg-gray-400"></div>
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
      <div className="mx-auto mt-4 w-full max-w-sm">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {/* Header with avatar */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <img
                src={avatarUrl}
                alt={`${userName} avatar`}
                className="h-12 w-12 rounded-full"
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {userName}
                </h3>
                <p className="text-sm text-gray-500">
                  These exercises have been picked for you, but you can replace any of them.
                </p>
              </div>
            </div>
          </div>

          {/* Exercise list */}
          <div className="p-4">
            <div className="space-y-6">
              {clientExercises.map((exercise, index) => (
                <div key={exercise.id} className="group flex items-center">
                  <div className="flex-1">
                    <span className="text-base font-medium text-gray-800">
                      {exercise.name}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedExercise(exercise);
                      setSelectedExerciseIndex(index);
                      // Skip the modal and go directly to exercise selection
                      setShowExerciseSelection(true);
                    }}
                    className="ml-2 rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                    aria-label="Replace exercise"
                  >
                    Replace
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ready Button */}
      <div className="mx-auto mt-6 max-w-sm px-4">
        {clientInfoResponse?.status === 'workout_ready' ? (
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
                    Replacing: {selectedExercise?.name}
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
                                  onClick={() => setSelectedReplacement(exercise.name)}
                                  className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors ${
                                    selectedReplacement === exercise.name
                                      ? 'bg-indigo-50 text-indigo-700'
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <span className="font-medium">
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
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                  selectedReplacement && !swapExerciseMutation.isPending
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "cursor-not-allowed bg-gray-300 text-gray-500"
                }`}
              >
                {swapExerciseMutation.isPending ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin text-white" />
                    Saving...
                  </>
                ) : (
                  "Confirm Change"
                )}
              </button>
            </div>
          </div>
        </>
      )}
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
