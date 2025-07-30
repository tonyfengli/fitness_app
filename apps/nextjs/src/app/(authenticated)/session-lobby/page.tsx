"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeCheckIns } from "~/hooks/useRealtimeCheckIns";
import { useRealtimePreferences } from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";

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
  return muscle.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Preference tag component
function PreferenceTag({ label, value, type }: { label: string; value: string | string[]; type: string }) {
  const getTagColor = () => {
    switch (type) {
      case 'intensity':
        if (value === 'low') return 'bg-blue-100 text-blue-800';
        if (value === 'moderate') return 'bg-yellow-100 text-yellow-800';
        if (value === 'high') return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
      case 'goal':
        return 'bg-purple-100 text-purple-800';
      case 'target':
        return 'bg-green-100 text-green-800';
      case 'avoid':
        return 'bg-orange-100 text-orange-800';
      case 'joint':
        return 'bg-pink-100 text-pink-800';
      case 'include':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format display value - convert muscle names if it's a target/avoid type
  const displayValue = Array.isArray(value) 
    ? (type === 'target' || type === 'avoid') 
      ? value.map(formatMuscleName).join(', ')
      : value.join(', ')
    : (type === 'target' || type === 'avoid') && typeof value === 'string'
      ? formatMuscleName(value)
      : value;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColor()}`}>
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

export default function SessionLobby() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const [checkedInClients, setCheckedInClients] = useState<CheckedInClient[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingTestClients, setIsAddingTestClients] = useState(false);
  const [configureMode, setConfigureMode] = useState(true); // Default to true for configure mode
  const [isStartingSession, setIsStartingSession] = useState(false);
  
  // Send session start messages mutation
  const sendStartMessagesMutation = useMutation({
    ...trpc.trainingSession.sendSessionStartMessages.mutationOptions(),
    onSuccess: (data) => {
      console.log('[SessionLobby] SMS send result:', data);
    },
    onError: (error: any) => {
      console.error('[SessionLobby] Failed to send start messages:', error);
      console.error('[SessionLobby] Error details:', {
        message: error.message,
        data: error.data,
        shape: error.shape
      });
      // Don't block navigation on error
    }
  });
  
  // Debug: Log mutation state
  useEffect(() => {
    if (sendStartMessagesMutation.error) {
      console.error('[SessionLobby] Mutation error state:', sendStartMessagesMutation.error);
    }
  }, [sendStartMessagesMutation.error]);
  
  // Fetch initial checked-in clients
  const { data: initialClients, isLoading } = useQuery(
    sessionId ? trpc.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ["disabled"],
      queryFn: () => Promise.resolve([])
    }
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
    }
  });
  
  // Add test clients mutation
  const addTestClientsMutation = useMutation({
    ...trpc.trainingSession.addTestClients.mutationOptions(),
    onMutate: () => {
      setIsAddingTestClients(true);
    },
    onSuccess: (data) => {
      // Add the new clients to the state
      const newClients: CheckedInClient[] = data.clients.map(client => ({
        userId: client.userId,
        userName: client.name,
        userEmail: client.email,
        checkedInAt: client.checkedInAt,
        preferences: null,
        isNew: true,
      }));
      
      setCheckedInClients(prev => [...newClients, ...prev]);
      
      // Remove the "new" flag after animation completes
      setTimeout(() => {
        setCheckedInClients(prev => 
          prev.map(client => ({ ...client, isNew: false }))
        );
      }, 1000);
      
      setIsAddingTestClients(false);
    },
    onError: (error: any) => {
      setError(`Failed to add test clients: ${error.message}`);
      setIsAddingTestClients(false);
    }
  });
  
  // Set initial clients when data loads
  useEffect(() => {
    if (initialClients) {
      setCheckedInClients(initialClients.map(client => ({
        ...client,
        preferences: client.preferences
      })));
    }
  }, [initialClients]);
  
  // Handle new check-ins from SSE
  const handleCheckIn = useCallback((event: CheckInEvent) => {
    setCheckedInClients(prev => {
      // Check if client already exists
      const exists = prev.some(client => client.userId === event.userId);
      if (exists) {
        return prev;
      }
      
      // Add new client at the beginning with animation flag
      return [{
        userId: event.userId,
        userName: event.name,
        userEmail: "", // We don't have email from the event
        checkedInAt: new Date(event.checkedInAt),
        preferences: null, // Start with no preferences
        isNew: true
      }, ...prev];
    });
    
    // Remove the "new" flag after animation completes
    setTimeout(() => {
      setCheckedInClients(prev => 
        prev.map(client => ({ ...client, isNew: false }))
      );
    }, 1000);
  }, []);
  
  // Handle preference updates from realtime
  const handlePreferenceUpdate = useCallback((update: any) => {
    console.log('[SessionLobby] Preference update received:', update);
    
    setCheckedInClients(prev => {
      return prev.map(client => {
        if (client.userId === update.userId) {
          return {
            ...client,
            preferences: update.preferences,
            preferencesUpdated: true
          };
        }
        return client;
      });
    });
    
    // Remove the update flag after animation
    setTimeout(() => {
      setCheckedInClients(prev => 
        prev.map(client => ({ ...client, preferencesUpdated: false }))
      );
    }, 1000);
  }, []);
  
  // Set up Supabase Realtime for check-ins
  const { isConnected, error: realtimeError } = useRealtimeCheckIns({
    sessionId: sessionId || '',
    onCheckIn: handleCheckIn,
    onError: (err) => setError(err.message)
  });
  
  // Set up Supabase Realtime for preferences
  const { isConnected: preferencesConnected } = useRealtimePreferences({
    sessionId: sessionId || '',
    supabase,
    onPreferenceUpdate: handlePreferenceUpdate,
    onError: (err) => console.error('[SessionLobby] Preference realtime error:', err)
  });
  
  useEffect(() => {
    if (isConnected && preferencesConnected) setConnectionStatus("connected");
    else if (!isConnected || !preferencesConnected) setConnectionStatus("disconnected");
  }, [isConnected, preferencesConnected]);
  
  
  if (!sessionId) {
    return (
      <div className="bg-white font-sans min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">No Session Selected</h1>
            <p className="mt-2 text-gray-600">Please select a session from the sessions page.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white font-sans min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          {/* Error Banner - only show for actual errors */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}
          {/* Realtime Connection Warning */}
          {realtimeError && !error && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>Real-time updates are temporarily unavailable. Check-ins will still be recorded but may not appear instantly.</span>
              </div>
            </div>
          )}
        </div>
        
        <main className="mt-4">
          <div className="text-center mb-8 relative">
            {/* Delete button in top right */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="absolute right-0 top-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200 group"
              title="Delete session"
            >
              <svg className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Session Lobby</h1>
            <p className="text-gray-600">
              {checkedInClients.length} client{checkedInClients.length !== 1 ? 's' : ''} checked in
            </p>
            <div className="mt-2 h-6 flex items-center justify-center">
              {connectionStatus === "connected" ? (
                <span className="text-green-600 text-xl">✓</span>
              ) : connectionStatus === "disconnected" && !error ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-gray-600">Connecting...</span>
                </div>
              ) : connectionStatus === "reconnecting" ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-yellow-600">Reconnecting...</span>
                </div>
              ) : null}
            </div>
          </div>
          
          <div className="text-center mb-8 space-y-4">
            {/* Configure Mode Toggle */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <label htmlFor="configure-mode" className="text-sm font-medium text-gray-700">
                Enable Configure Mode
              </label>
              <button
                id="configure-mode"
                role="switch"
                aria-checked={configureMode}
                onClick={() => setConfigureMode(!configureMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  configureMode ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    configureMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <button 
              onClick={async () => {
                if (sessionId) {
                  setIsStartingSession(true);
                  
                  // Always send start messages to auto-populate includeExercises for BMF templates
                  // Fire and forget - don't await
                  sendStartMessagesMutation.mutate({ sessionId });
                  
                  // Navigate immediately
                  if (configureMode) {
                    router.push(`/session-lobby/group-visualization?sessionId=${sessionId}`);
                  } else {
                    router.push(`/preferences?sessionId=${sessionId}`);
                  }
                }
              }}
              disabled={isStartingSession || checkedInClients.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 text-lg inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isStartingSession ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Starting Session...
                </>
              ) : (
                'Start Session'
              )}
            </button>
            
            {/* Add Test Clients Button */}
            <div>
              <button
                onClick={() => sessionId && addTestClientsMutation.mutate({ sessionId })}
                disabled={isAddingTestClients}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-200 text-sm inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingTestClients ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add 3 Test Clients
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-16 max-w-3xl mx-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading checked-in clients...</p>
              </div>
            ) : checkedInClients.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No clients have checked in yet.</p>
                <p className="text-4xl font-bold text-gray-800 mt-4">
                  Text "here" to 562-608-1666
                </p>
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
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start space-x-4">
                        {/* Avatar */}
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.userId}`}
                          alt={client.userName || "User"}
                          className="w-12 h-12 rounded-full"
                        />
                        
                        {/* Content */}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {client.userName || "Unknown"}
                          </h3>
                          
                          {/* Preference Tags */}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {client.preferences?.intensity && client.preferences.intensity !== 'moderate' && (
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
                            
                            {client.preferences?.muscleTargets && client.preferences.muscleTargets.length > 0 && (
                              <PreferenceTag 
                                label="Target" 
                                value={client.preferences.muscleTargets} 
                                type="target" 
                              />
                            )}
                            
                            {client.preferences?.muscleLessens && client.preferences.muscleLessens.length > 0 && (
                              <PreferenceTag 
                                label="Avoid muscles" 
                                value={client.preferences.muscleLessens} 
                                type="avoid" 
                              />
                            )}
                            
                            {client.preferences?.avoidJoints && client.preferences.avoidJoints.length > 0 && (
                              <PreferenceTag 
                                label="Protect" 
                                value={client.preferences.avoidJoints} 
                                type="joint" 
                              />
                            )}
                            
                            {client.preferences?.avoidExercises && client.preferences.avoidExercises.length > 0 && (
                              <PreferenceTag 
                                label="Skip" 
                                value={client.preferences.avoidExercises} 
                                type="avoid" 
                              />
                            )}
                            
                            {client.preferences?.includeExercises && client.preferences.includeExercises.length > 0 && (
                              <PreferenceTag 
                                label="Include" 
                                value={client.preferences.includeExercises} 
                                type="include" 
                              />
                            )}
                            
                            {!client.preferences || (
                              (client.preferences.intensity === 'moderate' || !client.preferences.intensity) && 
                              !client.preferences.sessionGoal && 
                              !client.preferences.muscleTargets?.length && 
                              !client.preferences.muscleLessens?.length && 
                              !client.preferences.avoidJoints?.length &&
                              !client.preferences.avoidExercises?.length &&
                              !client.preferences.includeExercises?.length
                            ) && (
                              <span className="text-sm text-gray-500 italic">
                                Awaiting preferences...
                              </span>
                            )}
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
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Delete training session
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete this training session? This action cannot be undone.
                      All check-ins and workout preferences for this session will be permanently removed.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isDeleting}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => sessionId && deleteSessionMutation.mutate({ sessionId })}
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete session'
                  )}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
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