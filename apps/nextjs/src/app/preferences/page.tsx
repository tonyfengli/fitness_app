"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  CheckIcon,
  ExerciseListItem,
  formatMuscleLabel,
  PreferenceListItem,
  useRealtimePreferences,
  useRealtimeStatus,
} from "@acme/ui-shared";

import { supabase } from "~/lib/supabase";
import { useTRPC } from "~/trpc/react";

function PreferencesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    isGenerating: boolean;
    currentStep: string;
    error: string | null;
  }>({
    isGenerating: false,
    currentStep: "",
    error: null,
  });

  // Mutation for marking all clients ready (defined after we have access to refetchClients)
  const markAllReady = useMutation(
    trpc.trainingSession.markAllClientsReady.mutationOptions({
      onSuccess: async (data) => {
        console.log(`Marked ${data.readyCount} clients as ready`);
        // Refresh queries to update UI
        await queryClient.invalidateQueries();
        setShowMenu(false);
      },
      onError: (error) => {
        console.error("Failed to mark all clients ready:", error);
        alert("Failed to mark all clients ready. Please try again.");
      },
    }),
  );

  // Blueprint generation state and function
  const [shouldGenerate, setShouldGenerate] = useState(false);

  // Blueprint generation query
  const { refetch: generateBlueprint } = useQuery({
    ...trpc.trainingSession.generateGroupWorkoutBlueprint.queryOptions({
      sessionId: sessionId || "",
      options: {
        includeDiagnostics: true,
        phase1Only: true, // Only run Phase 1 for visualization
      },
    }),
    enabled: false, // Only run when we manually trigger it
  });

  // Save visualization data mutation
  const saveVisualization = useMutation(
    trpc.trainingSession.saveVisualizationData.mutationOptions(),
  );

  // Handler for View Visualization button
  const handleGenerateAndNavigate = async () => {
    if (!sessionId) return;

    // First check if workouts already exist (from TV app)
    // If they do, just navigate directly to visualization
    try {
      const existingSelections = await trpc.workoutSelections.getSelections.query({
        sessionId,
      });
      
      if (existingSelections && existingSelections.length > 0) {
        console.log("Found existing workout selections, navigating directly to visualization");
        router.push(`/session-lobby/group-visualization?sessionId=${sessionId}`);
        return;
      }
    } catch (error) {
      console.error("Error checking existing selections:", error);
    }

    setGenerationProgress({
      isGenerating: true,
      currentStep: "Generating blueprint...",
      error: null,
    });
    setShowMenu(false);

    try {
      // Step 1: Generate blueprint with LLM
      setGenerationProgress((prev) => ({
        ...prev,
        currentStep: "Generating blueprint...",
      }));
      const { data: result } = await generateBlueprint();

      // Step 2: Check if LLM result exists
      if (!result || !result.llmResult || result.llmResult.error) {
        throw new Error("Failed to generate exercise selections");
      }

      setGenerationProgress((prev) => ({
        ...prev,
        currentStep: "Saving exercise selections...",
      }));

      // Step 3: Save the visualization data
      if (result && sessionId) {
        // Log what we're about to save
        console.log("💾 PREFERENCES: About to save visualization data:", {
          hasBlueprint: !!result.blueprint,
          hasClientPools: !!result.blueprint?.clientExercisePools,
          clientPoolKeys: result.blueprint?.clientExercisePools
            ? Object.keys(result.blueprint.clientExercisePools)
            : [],
          hasBucketedSelections: result.blueprint?.clientExercisePools
            ? Object.entries(result.blueprint.clientExercisePools).map(
                ([clientId, pool]: [string, any]) => ({
                  clientId,
                  hasBucketedSelection: !!pool.bucketedSelection,
                  bucketedCount: pool.bucketedSelection?.exercises?.length || 0,
                }),
              )
            : [],
        });

        await saveVisualization.mutateAsync({
          sessionId,
          visualizationData: {
            blueprint: result.blueprint,
            groupContext: result.groupContext,
            llmResult: result.llmResult,
            summary: result.summary,
            exerciseMetadata:
              result.blueprint?.clientExercisePools || undefined,
            sharedExerciseIds:
              result.blueprint?.sharedExercisePool?.map((e: any) => e.id) ||
              undefined,
          },
        });
      }

      // Small delay to show the final step
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 4: Navigate to exercise selection page
      router.push(
        `/workout-overview?sessionId=${sessionId}&userId=${checkedInClients?.[0]?.userId}`,
      );
    } catch (error) {
      console.error("Generation failed:", error);
      setGenerationProgress({
        isGenerating: false,
        currentStep: "",
        error:
          error instanceof Error ? error.message : "Failed to generate workout",
      });
    }
  };

  // This page shows a read-only view of all client preferences
  // Real-time updates are handled via Supabase subscriptions
  // When clients update their preferences, this view updates automatically

  // Fetch checked-in clients for the session
  const {
    data: checkedInClients,
    isLoading: clientsLoading,
    refetch: refetchClients,
  } = useQuery(
    sessionId
      ? {
          ...trpc.trainingSession.getCheckedInClients.queryOptions({
            sessionId,
          }),
          staleTime: 5000, // Consider data fresh for 5 seconds
          refetchOnMount: "always", // Always refetch on mount to ensure fresh data
        }
      : {
          enabled: false,
          queryKey: ["disabled"],
          queryFn: () => Promise.resolve([]),
        },
  );

  // Check if all clients are ready
  const allClientsReady =
    checkedInClients?.length > 0 &&
    checkedInClients.every((client) => client.status === "ready");

  const isLoading = clientsLoading;

  // Handle realtime preference updates
  const handlePreferenceUpdate = useCallback(
    (update: any) => {
      // Invalidate the checked-in clients query to refetch the latest data
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as any[];
          return (
            queryKey[0]?.[0] === "trainingSession" &&
            queryKey[0]?.[1] === "getCheckedInClients" &&
            queryKey[1]?.input?.sessionId === sessionId
          );
        },
      });
    },
    [sessionId, queryClient],
  );

  // Handle realtime status updates
  const handleStatusUpdate = useCallback(
    (update: any) => {
      console.log("[PreferencesPage] Status update received:", update);
      // Invalidate the checked-in clients query to refetch the latest data
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as any[];
          return (
            queryKey[0]?.[0] === "trainingSession" &&
            queryKey[0]?.[1] === "getCheckedInClients" &&
            queryKey[1]?.input?.sessionId === sessionId
          );
        },
      });
    },
    [sessionId, queryClient],
  );

  // Subscribe to realtime preference updates
  const { isConnected: preferencesConnected } = useRealtimePreferences({
    sessionId: sessionId || "",
    supabase,
    onPreferenceUpdate: handlePreferenceUpdate,
  });

  // Subscribe to realtime status updates
  const { isConnected: statusConnected } = useRealtimeStatus({
    sessionId: sessionId || "",
    supabase,
    onStatusUpdate: handleStatusUpdate,
  });

  if (!sessionId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            No Session Selected
          </h1>
          <p className="mt-2 text-gray-600">
            Please select a session from the sessions page.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading clients...</p>
        </div>
      </div>
    );
  }

  // Helper function to get exercises for a client - matches client view exactly
  const getClientExercisesForRounds = (clientId: string) => {
    // This should match the logic from the client preferences page
    const clientData = checkedInClients?.find((c) => c.userId === clientId);
    if (!clientData) return [];

    const avoidedExercises = clientData.preferences?.avoidExercises || [];
    const includeExercises = clientData.preferences?.includeExercises || [];

    const exercises: {
      name: string;
      confirmed: boolean;
      isExcluded: boolean;
      isActive: boolean;
    }[] = [];

    // For BMF templates, includeExercises contains the current selections
    // Round1 = index 0, Round2 = index 1
    const round1Exercise = includeExercises[0];
    const round2Exercise = includeExercises[1];

    // Add active exercises from includeExercises
    if (round1Exercise) {
      exercises.push({
        name: round1Exercise,
        confirmed: true,
        isExcluded: false,
        isActive: true,
      });
    }

    if (round2Exercise) {
      exercises.push({
        name: round2Exercise,
        confirmed: true,
        isExcluded: false,
        isActive: true,
      });
    }

    // Add manually included exercises that aren't in the template
    includeExercises.forEach((includedExercise) => {
      // Only add if not already in the list and not excluded
      if (
        !exercises.find((ex) => ex.name === includedExercise) &&
        !avoidedExercises.includes(includedExercise)
      ) {
        exercises.push({
          name: includedExercise,
          confirmed: true,
          isExcluded: false,
          isActive: true,
        });
      }
    });

    // Filter out excluded exercises - we don't want to show them
    return exercises.filter((ex) => !ex.isExcluded);
  };

  // Transform checked-in clients to match the UI structure
  const clients =
    checkedInClients?.map((client) => ({
      id: client.userId,
      name: client.userName || "Unknown Client",
      avatar: client.userId,
      status: client.status,
      exerciseCount: client.preferences?.includeExercises?.length || 0,
      confirmedExercises: getClientExercisesForRounds(client.userId),
      muscleFocus: client.preferences?.muscleTargets || [],
      avoidance: client.preferences?.muscleLessens || [],
      notes: client.preferences?.notes || [],
      intensity: client.preferences?.intensity || "moderate",
      workoutType: client.preferences?.workoutType || null,
      includeFinisher:
        client.preferences?.notes?.includes("include_finisher") || false,
    })) || [];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Real-time Connection Status - Top Left */}
      <div className="fixed left-4 top-4 z-10">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div
            className={`h-2 w-2 rounded-full ${preferencesConnected && statusConnected ? "bg-green-500" : "bg-gray-400"}`}
          />
          <span>
            Live updates{" "}
            {preferencesConnected && statusConnected
              ? "active"
              : "connecting..."}
          </span>
        </div>
      </div>

      {/* Action Menu - Top Right */}
      <div className="fixed right-4 top-4 z-10">
        {/* Menu Toggle Button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="rounded-lg bg-white p-3 shadow-lg transition-colors hover:bg-gray-50"
        >
          <svg
            className="h-5 w-5 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute right-0 mt-2 min-w-[200px] space-y-1 rounded-lg bg-white p-2 shadow-lg">
            <button
              onClick={() => {
                router.back();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-gray-700 transition-colors hover:bg-gray-100"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back
            </button>

            <div className="my-1 border-t border-gray-200"></div>

            <button
              onClick={() => {
                if (sessionId) {
                  markAllReady.mutate({ sessionId });
                }
              }}
              disabled={!sessionId || markAllReady.isPending || allClientsReady}
              className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left transition-colors ${
                !sessionId || markAllReady.isPending || allClientsReady
                  ? "cursor-not-allowed text-gray-400"
                  : "text-blue-600 hover:bg-blue-50"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {markAllReady.isPending
                ? "Marking Ready..."
                : allClientsReady
                  ? "All Clients Ready"
                  : "Mark All Ready"}
            </button>

            <button
              onClick={() => {
                // Check if all clients are ready
                const allReady =
                  checkedInClients?.every(
                    (client) => client.status === "ready",
                  ) ?? false;
                if (!allReady) {
                  alert(
                    "All clients must be marked as ready before viewing visualization",
                  );
                  return;
                }
                handleGenerateAndNavigate();
              }}
              disabled={
                !checkedInClients?.every(
                  (client) => client.status === "ready",
                ) || generationProgress.isGenerating
              }
              className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left transition-colors ${
                !checkedInClients?.every(
                  (client) => client.status === "ready",
                ) || generationProgress.isGenerating
                  ? "cursor-not-allowed text-gray-400"
                  : "text-purple-600 hover:bg-purple-50"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              {generationProgress.isGenerating
                ? "Generating..."
                : "View Visualization"}
            </button>
          </div>
        )}
      </div>

      {/* Content - Centered Vertically and Horizontally */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl p-8">
          {/* Client Cards Grid */}
          {clients.length > 0 ? (
            <div className="grid grid-cols-1 place-items-center gap-6 md:grid-cols-2 lg:grid-cols-3">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className={`relative w-full max-w-sm rounded-xl bg-white transition-all duration-300 ${
                    client.status === "ready"
                      ? "scale-[1.02] border-2 border-blue-400 shadow-[0_0_40px_rgba(59,130,246,0.5)] ring-4 ring-blue-100/50"
                      : "border border-gray-200 shadow-lg hover:shadow-xl"
                  }`}
                >
                  {/* Ready Badge */}
                  {client.status === "ready" && (
                    <div className="absolute -right-2 -top-2 animate-pulse rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                      READY
                    </div>
                  )}

                  {/* Client Header */}
                  <div
                    className={`rounded-t-xl p-4 ${
                      client.status === "ready"
                        ? "border-b border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50"
                        : "border-b border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`relative ${client.status === "ready" ? "ring-2 ring-blue-400 ring-offset-2" : ""} rounded-full`}
                      >
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.avatar}`}
                          alt={client.name}
                          className="h-10 w-10 rounded-full"
                        />
                      </div>
                      <div className="flex-1">
                        <h3
                          className={`text-sm font-semibold ${
                            client.status === "ready"
                              ? "text-blue-900"
                              : "text-gray-900"
                          }`}
                        >
                          {client.name}
                        </h3>
                        {client.notes.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {client.notes.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Workout Focus */}
                  <div
                    className={`flex gap-3 border-b p-3 ${
                      client.status === "ready"
                        ? "border-blue-100"
                        : "border-gray-200"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        client.status === "ready"
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      1
                    </div>
                    <div className="flex flex-1 items-center">
                      <span className="text-sm text-gray-700">
                        {client.workoutType === "full_body_with_finisher" &&
                          "Full Body • With Finisher"}
                        {client.workoutType === "full_body_without_finisher" &&
                          "Full Body • No Finisher"}
                        {client.workoutType === "targeted_with_finisher" &&
                          "Targeted • With Finisher"}
                        {client.workoutType === "targeted_without_finisher" &&
                          "Targeted • No Finisher"}
                        {!client.workoutType && "Not Set"}
                      </span>
                    </div>
                  </div>

                  {/* Section 2: Muscle Focus */}
                  <div
                    className={`flex gap-3 border-b p-3 ${
                      client.status === "ready"
                        ? "border-blue-100"
                        : "border-gray-200"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        client.status === "ready"
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      2
                    </div>
                    <div className="flex flex-1 items-center">
                      <div className="flex flex-wrap gap-1">
                        {/* Muscle Target Badges */}
                        {client.muscleFocus.length > 0 ? (
                          client.muscleFocus.map((muscle, idx) => (
                            <span
                              key={`focus-${idx}`}
                              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                            >
                              {formatMuscleLabel(muscle)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-700">
                            No muscle targets
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Muscle Limit */}
                  <div
                    className={`flex gap-3 border-b p-3 ${
                      client.status === "ready"
                        ? "border-blue-100"
                        : "border-gray-200"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        client.status === "ready"
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      3
                    </div>
                    <div className="flex flex-1 items-center">
                      <div className="flex flex-wrap gap-1">
                        {/* Limit Badges */}
                        {client.avoidance.length > 0 ? (
                          client.avoidance.map((item, idx) => (
                            <span
                              key={`avoid-${idx}`}
                              className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                            >
                              {formatMuscleLabel(item)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-700">
                            No muscle limits
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Intensity */}
                  <div className="flex gap-3 p-3">
                    <div
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        client.status === "ready"
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      4
                    </div>
                    <div className="flex flex-1 items-center">
                      <span className="text-sm text-gray-700">
                        {client.intensity === "low" && "Low (4 exercises)"}
                        {client.intensity === "moderate" &&
                          "Moderate (5 exercises)"}
                        {client.intensity === "high" && "High (6 exercises)"}
                        {client.intensity === "intense" &&
                          "Intense (7 exercises)"}
                        {!client.intensity && "Moderate (5 exercises)"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-500">
                No clients have checked in to this session yet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Modal */}
      {generationProgress.isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
              <p className="mb-2 text-lg font-semibold text-gray-900">
                Generating Workout
              </p>
              <p className="text-center text-sm text-gray-600">
                {generationProgress.currentStep}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {generationProgress.error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() =>
            setGenerationProgress((prev) => ({ ...prev, error: null }))
          }
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="mb-2 text-lg font-semibold text-gray-900">
                Generation Failed
              </p>
              <p className="mb-4 text-center text-sm text-gray-600">
                {generationProgress.error}
              </p>
              <button
                onClick={() =>
                  setGenerationProgress((prev) => ({ ...prev, error: null }))
                }
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading preferences...</p>
          </div>
        </div>
      }
    >
      <PreferencesPageContent />
    </Suspense>
  );
}
