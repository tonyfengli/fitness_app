"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useRealtimePreferences } from "@acme/ui-shared";

import { useRealtimeCheckIns } from "~/hooks/useRealtimeCheckIns";
import { supabase } from "~/lib/supabase";
import { useTRPC } from "~/trpc/react";

// Types
interface CheckInEvent {
  user_id: string;
  training_session_id: string;
  user_name?: string;
  user_email?: string;
  checked_in_at?: string;
  preferences?: any;
}

// Helper to format muscle names for display (convert underscore to space and capitalize)
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Preference tag component
function PreferenceTag({
  label,
  value,
  type,
}: {
  label: string;
  value: string | string[];
  type: string;
}) {
  const getTagColor = () => {
    switch (type) {
      case "intensity":
        if (value === "low") return "bg-blue-100 text-blue-800";
        if (value === "moderate") return "bg-yellow-100 text-yellow-800";
        if (value === "high") return "bg-red-100 text-red-800";
        return "bg-gray-100 text-gray-800";
      case "goal":
        return "bg-purple-100 text-purple-800";
      case "target":
        return "bg-green-100 text-green-800";
      case "avoid":
        return "bg-orange-100 text-orange-800";
      case "joint":
        return "bg-pink-100 text-pink-800";
      case "include":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Format display value - convert muscle names if it's a target/avoid type
  const displayValue = Array.isArray(value)
    ? type === "target" || type === "avoid"
      ? value.map(formatMuscleName).join(", ")
      : value.join(", ")
    : (type === "target" || type === "avoid") && typeof value === "string"
      ? formatMuscleName(value)
      : value;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTagColor()}`}
    >
      {label}: {displayValue}
    </span>
  );
}

interface CheckedInClient {
  userId: string;
  userName: string | null;
  userEmail: string;
  checkedInAt: Date | null;
  preferences?: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    includeExercises?: string[] | null;
    avoidExercises?: string[] | null;
    avoidJoints?: string[] | null;
    sessionGoal?: string | null;
  } | null;
  isNew?: boolean; // For animation purposes
  preferencesUpdated?: boolean; // For preference update animation
}

function SessionLobbyContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [checkedInClients, setCheckedInClients] = useState<CheckedInClient[]>(
    [],
  );
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [configureMode, setConfigureMode] = useState(false); // Default to false for configure mode
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Send session start messages mutation
  const sendStartMessagesMutation = useMutation({
    ...trpc.trainingSession.sendSessionStartMessages.mutationOptions(),
    onSuccess: (data) => {
      console.log("[SessionLobby] SMS send result:", data);
    },
    onError: (error: any) => {
      console.error("[SessionLobby] Failed to send start messages:", error);
      console.error("[SessionLobby] Error details:", {
        message: error.message,
        data: error.data,
        shape: error.shape,
      });
      // Don't block navigation on error
    },
  });

  // Debug: Log mutation state
  useEffect(() => {
    if (sendStartMessagesMutation.error) {
      console.error(
        "[SessionLobby] Mutation error state:",
        sendStartMessagesMutation.error,
      );
    }
  }, [sendStartMessagesMutation.error]);

  // Fetch initial checked-in clients
  const { data: initialClients, isLoading } = useQuery(
    sessionId
      ? trpc.trainingSession.getCheckedInClients.queryOptions({ sessionId })
      : {
          enabled: false,
          queryKey: ["disabled"],
          queryFn: () => Promise.resolve([]),
        },
  );

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    ...trpc.trainingSession.deleteSession.mutationOptions(),
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      router.push("/sessions");
    },
    onError: (error: any) => {
      setError(`Failed to delete session: ${error.message}`);
      setIsDeleting(false);
    },
  });

  // Set initial clients when data loads
  useEffect(() => {
    if (initialClients) {
      setCheckedInClients(
        initialClients.map((client) => ({
          ...client,
          preferences: client.preferences,
        })),
      );
    }
  }, [initialClients]);

  // Handle new check-ins from SSE
  const handleCheckIn = useCallback((event: CheckInEvent) => {
    setCheckedInClients((prev) => {
      // Check if client already exists
      const exists = prev.some((client) => client.userId === event.userId);
      if (exists) {
        return prev;
      }

      // Add new client at the beginning with animation flag
      return [
        {
          userId: event.userId,
          userName: event.name,
          userEmail: "", // We don't have email from the event
          checkedInAt: new Date(event.checkedInAt),
          preferences: null, // Start with no preferences
          isNew: true,
        },
        ...prev,
      ];
    });

    // Remove the "new" flag after animation completes
    setTimeout(() => {
      setCheckedInClients((prev) =>
        prev.map((client) => ({ ...client, isNew: false })),
      );
    }, 1000);
  }, []);

  // Handle preference updates from realtime
  const handlePreferenceUpdate = useCallback((update: any) => {
    console.log("[SessionLobby] Preference update received:", update);

    setCheckedInClients((prev) => {
      return prev.map((client) => {
        if (client.userId === update.userId) {
          return {
            ...client,
            preferences: update.preferences,
            preferencesUpdated: true,
          };
        }
        return client;
      });
    });

    // Remove the update flag after animation
    setTimeout(() => {
      setCheckedInClients((prev) =>
        prev.map((client) => ({ ...client, preferencesUpdated: false })),
      );
    }, 1000);
  }, []);

  // Set up Supabase Realtime for check-ins
  const { isConnected, error: realtimeError } = useRealtimeCheckIns({
    sessionId: sessionId || "",
    onCheckIn: handleCheckIn,
    onError: (err) => setError(err.message),
  });

  // Set up Supabase Realtime for preferences
  const { isConnected: preferencesConnected } = useRealtimePreferences({
    sessionId: sessionId || "",
    supabase,
    onPreferenceUpdate: handlePreferenceUpdate,
    onError: (err) =>
      console.error("[SessionLobby] Preference realtime error:", err),
  });

  useEffect(() => {
    console.log("[SessionLobby] Connection status:", {
      isConnected,
      preferencesConnected,
    });
    if (isConnected && preferencesConnected) {
      setConnectionStatus("connected");
    } else if (!isConnected || !preferencesConnected) {
      setConnectionStatus("disconnected");
    }
  }, [isConnected, preferencesConnected]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              No Session Selected
            </h1>
            <p className="mt-2 text-gray-600">
              Please select a session from the sessions page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          {/* Error Banner - only show for actual errors */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {/* Realtime Connection Warning */}
          {realtimeError && !error && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  Real-time updates are temporarily unavailable. Check-ins will
                  still be recorded but may not appear instantly.
                </span>
              </div>
            </div>
          )}
        </div>

        <main className="relative mt-4">
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
                    setConfigureMode(!configureMode);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-4 py-2 text-left text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <div className="flex items-center gap-2">
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
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Configure Mode
                  </div>
                  <span
                    className={`text-xs ${configureMode ? "text-green-600" : "text-gray-400"}`}
                  >
                    {configureMode ? "ON" : "OFF"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowDeleteModal(true);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-red-600 transition-colors hover:bg-red-50"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Session
                </button>
              </div>
            )}
          </div>

          <div className="mb-8 text-center">
            <button
              onClick={async () => {
                if (sessionId) {
                  setIsStartingSession(true);

                  // Always send start messages to auto-populate includeExercises for BMF templates
                  // Fire and forget - don't await
                  sendStartMessagesMutation.mutate({ sessionId });

                  // Navigate immediately
                  if (configureMode) {
                    router.push(
                      `/session-lobby/group-visualization?sessionId=${sessionId}`,
                    );
                  } else {
                    router.push(`/preferences?sessionId=${sessionId}`);
                  }
                }
              }}
              disabled={isStartingSession || checkedInClients.length === 0}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-8 py-3 text-base font-medium text-gray-900 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:border-gray-200"
            >
              {isStartingSession ? (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4 animate-spin text-gray-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Starting...
                </>
              ) : (
                <>
                  Start Session
                  <svg
                    className="ml-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>

          <div className="mx-auto mt-16 max-w-3xl">
            {isLoading ? (
              <div className="py-12 text-center">
                <p className="text-gray-500">Loading checked-in clients...</p>
              </div>
            ) : checkedInClients.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto max-w-md">
                  {/* Simple text */}
                  <p className="mb-1 text-gray-500">Text "here" to</p>
                  <p className="text-xl font-semibold text-gray-700">
                    562-608-1666
                  </p>

                  {/* Connection status indicator */}
                  <div className="mt-8 flex items-center justify-center">
                    {connectionStatus === "connected" ? (
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                    ) : connectionStatus === "disconnected" && !error ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <svg
                          className="h-4 w-4 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Connecting...</span>
                      </div>
                    ) : connectionStatus === "reconnecting" ? (
                      <div className="flex items-center gap-2 text-sm text-yellow-600">
                        <svg
                          className="h-4 w-4 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Reconnecting...</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {checkedInClients.map((client) => (
                  <div
                    key={client.userId}
                    className={`transition-all duration-1000 ${
                      client.isNew
                        ? "animate-fadeIn bg-green-50"
                        : client.preferencesUpdated
                          ? "animate-pulse bg-blue-50"
                          : ""
                    } rounded-lg`}
                  >
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-start space-x-4">
                        {/* Avatar */}
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.userId}`}
                          alt={client.userName || "User"}
                          className="h-12 w-12 rounded-full"
                        />

                        {/* Content */}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {client.userName || "Unknown"}
                          </h3>

                          {/* Preference Tags */}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {client.preferences?.intensity &&
                              client.preferences.intensity !== "moderate" && (
                                <PreferenceTag
                                  label="Intensity"
                                  value={client.preferences.intensity}
                                  type="intensity"
                                />
                              )}

                            {client.preferences?.sessionGoal && (
                              <PreferenceTag
                                label="Goal"
                                value={client.preferences.sessionGoal}
                                type="goal"
                              />
                            )}

                            {client.preferences?.muscleTargets &&
                              client.preferences.muscleTargets.length > 0 && (
                                <PreferenceTag
                                  label="Target"
                                  value={client.preferences.muscleTargets}
                                  type="target"
                                />
                              )}

                            {client.preferences?.muscleLessens &&
                              client.preferences.muscleLessens.length > 0 && (
                                <PreferenceTag
                                  label="Avoid muscles"
                                  value={client.preferences.muscleLessens}
                                  type="avoid"
                                />
                              )}

                            {client.preferences?.avoidJoints &&
                              client.preferences.avoidJoints.length > 0 && (
                                <PreferenceTag
                                  label="Protect"
                                  value={client.preferences.avoidJoints}
                                  type="joint"
                                />
                              )}

                            {client.preferences?.avoidExercises &&
                              client.preferences.avoidExercises.length > 0 && (
                                <PreferenceTag
                                  label="Skip"
                                  value={client.preferences.avoidExercises}
                                  type="avoid"
                                />
                              )}

                            {client.preferences?.includeExercises &&
                              client.preferences.includeExercises.length >
                                0 && (
                                <PreferenceTag
                                  label="Include"
                                  value={client.preferences.includeExercises}
                                  type="include"
                                />
                              )}

                            {!client.preferences ||
                              ((client.preferences.intensity === "moderate" ||
                                !client.preferences.intensity) &&
                                !client.preferences.sessionGoal &&
                                !client.preferences.muscleTargets?.length &&
                                !client.preferences.muscleLessens?.length &&
                                !client.preferences.avoidJoints?.length &&
                                !client.preferences.avoidExercises?.length &&
                                !client.preferences.includeExercises
                                  ?.length && (
                                  <span className="text-sm italic text-gray-500">
                                    Awaiting preferences...
                                  </span>
                                ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => !isDeleting && setShowDeleteModal(false)}
            />

            {/* Modal panel */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Delete training session
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete this training session?
                      This action cannot be undone. All check-ins and workout
                      preferences for this session will be permanently removed.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isDeleting}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto"
                  onClick={() =>
                    sessionId && deleteSessionMutation.mutate({ sessionId })
                  }
                >
                  {isDeleting ? (
                    <>
                      <svg
                        className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    "Delete session"
                  )}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0 sm:w-auto"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function SessionLobby() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading session lobby...</p>
          </div>
        </div>
      }
    >
      <SessionLobbyContent />
    </Suspense>
  );
}
