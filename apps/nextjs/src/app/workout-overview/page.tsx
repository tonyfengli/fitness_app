"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Removed ClientWorkoutCard import - using custom component
import { Button, Icon, useRealtimeExerciseSwaps } from "@acme/ui-shared";

import { useExerciseSelections } from "~/hooks/useExerciseSelections";
import { supabase } from "~/lib/supabase";
import { useTRPC } from "~/trpc/react";

// Constants
const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

// Workout card component that receives exercises as props (no additional fetching)
function WorkoutCard({
  workoutData,
  exercises,
}: {
  workoutData: any;
  exercises: any[];
}) {
  const userName =
    workoutData.user.name || workoutData.user.email.split("@")[0];
  const avatarUrl = `${AVATAR_API_URL}?seed=${encodeURIComponent(userName)}`;

  // Get all exercises as a flat list with swap indicator
  const exerciseList =
    exercises?.map((ex) => ({
      id: ex.id,
      name: ex.exercise.name,
      isSwapped: ex.selectionSource === "manual_swap",
    })) || [];

  return (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <img
            src={avatarUrl}
            alt={`${userName} avatar`}
            className="h-12 w-12 rounded-full"
          />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{userName}</h3>
          </div>
        </div>
      </div>

      <div className="p-4">
        <ol className="space-y-2">
          {exerciseList.map((exercise, index) => (
            <li key={exercise.id} className="flex items-start">
              <span className="mr-3 mt-0.5 text-gray-500">{index + 1}.</span>
              <div className="flex-1">
                <span className="text-gray-800">{exercise.name}</span>
                {exercise.isSwapped && (
                  <span className="ml-2 inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Swapped
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function WorkoutOverviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [lastSwapTime, setLastSwapTime] = useState<Date | null>(null);

  // Use real-time exercise swap updates
  const { isConnected: swapUpdatesConnected } = useRealtimeExerciseSwaps({
    sessionId: sessionId || "",
    supabase,
    onSwapUpdate: (swap) => {
      console.log("[WorkoutOverview] Exercise swap detected:", swap);
      setLastSwapTime(new Date());

      // Force refetch of exercise selections
      queryClient.invalidateQueries({
        queryKey: [
          ["workoutSelections", "getSelections"],
          {
            input: {
              sessionId: sessionId,
            },
            type: "query",
          },
        ],
      });

      // Also invalidate the specific hook's query
      queryClient.refetchQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as any[];
          return (
            queryKey[0] &&
            Array.isArray(queryKey[0]) &&
            queryKey[0][0] === "workoutSelections" &&
            queryKey[0][1] === "getSelections"
          );
        },
      });
    },
    onError: (error) => {
      console.error("[WorkoutOverview] Real-time swap error:", error);
    },
  });

  // Fetch exercise selections instead of workouts
  const { selections, isLoading, error } = useExerciseSelections(sessionId);

  // Also fetch client information to get names
  const { data: clientsData } = useQuery({
    ...trpc.auth.getClientsByBusiness.queryOptions(),
    enabled: !!sessionId,
  });

  // Fetch session details to check status
  const { data: sessionData } = useQuery({
    ...trpc.trainingSession.getById.queryOptions({ id: sessionId || "" }),
    enabled: !!sessionId,
  });

  // Transform selections into workout-like structure for display
  // MUST be called before any conditional returns for hooks consistency
  const workouts = React.useMemo(() => {
    if (!selections || !clientsData) return [];

    // Group selections by client
    const selectionsByClient = selections.reduce(
      (acc, selection) => {
        if (!acc[selection.clientId]) {
          acc[selection.clientId] = [];
        }
        acc[selection.clientId].push(selection);
        return acc;
      },
      {} as Record<string, typeof selections>,
    );

    // Create workout-like objects for each client
    return Object.entries(selectionsByClient).map(
      ([clientId, clientSelections]) => {
        const client = clientsData.find((c) => c.id === clientId);

        return {
          workout: { id: clientId, userId: clientId },
          user: {
            name: client?.name || client?.email?.split("@")[0] || "Unknown",
            email: client?.email || "",
          },
          exercises: clientSelections.map((sel, index) => ({
            id: sel.id,
            exercise: { name: sel.exerciseName },
            selectionSource: sel.selectionSource,
          })),
        };
      },
    );
  }, [selections, clientsData]);

  if (!sessionId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-gray-500">No session ID provided</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-gray-500">Loading workouts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-red-500">Error loading workouts: {error.message}</p>
      </div>
    );
  }

  if (!workouts || workouts.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-gray-500">
          No exercise selections found for this session
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* WebSocket Connection Status */}
      <div className="fixed bottom-4 left-4 z-10 rounded-lg bg-white px-3 py-2 text-xs shadow-lg">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${swapUpdatesConnected ? "bg-green-500" : "bg-gray-400"}`}
          />
          <span className="text-gray-600">
            Real-time updates{" "}
            {swapUpdatesConnected ? "active" : "connecting..."}
          </span>
          {lastSwapTime && (
            <span className="ml-2 text-gray-500">
              Last swap: {lastSwapTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Workout Cards Grid */}
      <div className="grid grid-cols-1 place-items-center gap-6 md:grid-cols-2 lg:grid-cols-3">
        {workouts.map((workoutData) => (
          <WorkoutCard
            key={workoutData.workout.id}
            workoutData={workoutData}
            exercises={workoutData.exercises || []}
          />
        ))}
      </div>
    </div>
  );
}

function WorkoutOverviewMain() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [showMenu, setShowMenu] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const trpc = useTRPC();

  // Fetch session details to check status
  const { data: sessionData } = useQuery({
    ...trpc.trainingSession.getById.queryOptions({ id: sessionId || "" }),
    enabled: !!sessionId,
  });

  // Start workout mutation
  const startWorkoutMutation = useMutation({
    ...trpc.trainingSession.startWorkout.mutationOptions(),
    onSuccess: (data) => {
      console.log("Workout organized successfully:", data);
      // Navigate to workout-live after successful organization
      router.push(`/workout-live?sessionId=${sessionId}&round=1`);
    },
    onError: (error: any) => {
      console.error("Failed to start workout:", error);
      setIsStarting(false);
      // You might want to show an error toast here
      alert(`Failed to start workout: ${error.message}`);
    },
  });

  const handleStartWorkout = async () => {
    if (!sessionId) return;

    // Log timestamp when button is clicked
    console.log(
      `[Timestamp] Start Workout button clicked at: ${new Date().toISOString()}`,
    );

    setIsStarting(true);
    setShowMenu(false);

    // Call the startWorkout mutation
    startWorkoutMutation.mutate({ sessionId });
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Full screen loading overlay */}
      {isStarting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
            <p className="mt-4 font-medium text-gray-600">
              Organizing workout...
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Setting up rounds and equipment
            </p>
          </div>
        </div>
      )}

      {/* Menu Button - Top Right */}
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
                router.push("/sessions");
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
              Back to Sessions
            </button>

            <button
              onClick={() => {
                router.push(
                  `/session-lobby/group-visualization?sessionId=${sessionId}`,
                );
                setShowMenu(false);
              }}
              disabled={!sessionId}
              className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left transition-colors ${
                sessionId
                  ? "text-gray-700 hover:bg-gray-100"
                  : "cursor-not-allowed text-gray-400"
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
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
              Group Visualization
            </button>

            {sessionData?.status !== "completed" && (
              <button
                onClick={handleStartWorkout}
                disabled={!sessionId || isStarting}
                className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left transition-colors ${
                  sessionId && !isStarting
                    ? "text-blue-600 hover:bg-blue-50"
                    : "cursor-not-allowed text-gray-400"
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
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                  />
                </svg>
                Start Workout
              </button>
            )}

            <button
              onClick={() => {
                router.push(`/workout-live?sessionId=${sessionId}&round=1`);
                setShowMenu(false);
              }}
              disabled={!sessionId}
              className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left transition-colors ${
                sessionId
                  ? "text-green-600 hover:bg-green-50"
                  : "cursor-not-allowed text-gray-400"
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Go to Workout Live
            </button>
          </div>
        )}
      </div>

      {/* Content - Centered Vertically and Horizontally */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl p-8">
          <Suspense
            fallback={
              <div className="flex min-h-[400px] items-center justify-center">
                <p className="text-gray-500">Loading...</p>
              </div>
            }
          >
            <WorkoutOverviewContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutOverview() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <WorkoutOverviewMain />
    </Suspense>
  );
}
