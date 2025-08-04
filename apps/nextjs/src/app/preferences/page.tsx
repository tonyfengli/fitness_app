"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useGroupWorkoutBlueprint } from "~/hooks/useGroupWorkoutBlueprint";
import { useGenerateGroupWorkout } from "~/hooks/useGenerateGroupWorkout";
import { 
  useRealtimePreferences,
  PreferenceListItem,
  ExerciseListItem,
  CheckIcon,
  formatMuscleLabel
} from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";




export default function PreferencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  
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
        console.error('Failed to mark all clients ready:', error);
        alert('Failed to mark all clients ready. Please try again.');
      }
    })
  );
  
  // This page shows a read-only view of all client preferences
  // Real-time updates are handled via Supabase subscriptions
  // When clients update their preferences, this view updates automatically

  // Fetch checked-in clients for the session
  const { data: checkedInClients, isLoading: clientsLoading, refetch: refetchClients } = useQuery(
    sessionId ? {
      ...trpc.trainingSession.getCheckedInClients.queryOptions({ sessionId }),
      staleTime: 5000, // Consider data fresh for 5 seconds
      refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
    } : {
      enabled: false,
      queryKey: ["disabled"],
      queryFn: () => Promise.resolve([])
    }
  );

  // Check if all clients are ready
  const allClientsReady = checkedInClients?.length > 0 && 
    checkedInClients.every(client => client.status === 'ready');

  // Fetch workout blueprint to get exercise selections
  const { 
    blueprint,
    groupContext,
    isLoading: workoutLoading, 
    refetch: refetchWorkout 
  } = useGroupWorkoutBlueprint({
    sessionId,
    useCache: true,
    includeDiagnostics: false,
    enabled: !!sessionId && allClientsReady
  });

  // Combine for backward compatibility
  const workoutData = blueprint && groupContext ? { blueprint, groupContext } : null;
  
  const isLoading = clientsLoading || (allClientsReady && workoutLoading);
  
  // Handle realtime preference updates
  const handlePreferenceUpdate = useCallback((update: any) => {
    // Invalidate both queries at once to refetch the latest data
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey as any[];
        return queryKey[0]?.[0] === 'trainingSession' && 
               (queryKey[0]?.[1] === 'getCheckedInClients' || queryKey[0]?.[1] === 'generateGroupWorkoutBlueprint') &&
               queryKey[1]?.input?.sessionId === sessionId;
      }
    });
  }, [sessionId, queryClient]);
  
  // Subscribe to realtime preference updates
  useRealtimePreferences({
    sessionId: sessionId || '',
    supabase,
    onPreferenceUpdate: handlePreferenceUpdate
  });

  // Generate workout hook
  const { generateWorkout, isGenerating } = useGenerateGroupWorkout({
    sessionId: sessionId || '',
    navigateOnSuccess: true,
    includeDiagnostics: true,
    showToasts: true,
    onSuccess: (data) => {
      console.log('Workout generation response from preferences page:', data);
      
      if (data.debug) {
        console.log('=== WORKOUT GENERATION SYSTEM PROMPT (from preferences) ===');
        console.log(data.debug.systemPrompt);
        console.log('=== END SYSTEM PROMPT ===');
      } else {
        console.log('No debug data included in response. Make sure includeDiagnostics is set to true.');
      }
    }
  });
  

  if (!sessionId) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">No Session Selected</h1>
          <p className="mt-2 text-gray-600">Please select a session from the sessions page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clients...</p>
        </div>
      </div>
    );
  }

  // Helper function to get exercises for a client - matches client view exactly
  const getClientExercisesForRounds = (clientId: string) => {
    // This should match the logic from the client preferences page
    const clientData = checkedInClients?.find(c => c.userId === clientId);
    if (!clientData) return [];
    
    const avoidedExercises = clientData.preferences?.avoidExercises || [];
    const includeExercises = clientData.preferences?.includeExercises || [];
    
    const exercises: { name: string; confirmed: boolean; isExcluded: boolean; isActive: boolean }[] = [];
    
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
        isActive: true
      });
    }
    
    if (round2Exercise) {
      exercises.push({
        name: round2Exercise,
        confirmed: true,
        isExcluded: false,
        isActive: true
      });
    }
    
    // If no includeExercises, fall back to blueprint exercises
    if (exercises.length === 0 && workoutData?.blueprint) {
      // Check if it's a BMF blueprint (has blocks) or Standard blueprint (has clientExercisePools)
      if (workoutData.blueprint.blocks) {
        // BMF blueprint
        const rounds = ['Round1', 'Round2'];
        for (const round of rounds) {
          const block = workoutData.blueprint.blocks.find(b => b.blockId === round);
          if (block && block.individualCandidates && block.individualCandidates[clientId]) {
            const clientExercises = block.individualCandidates[clientId].exercises;
            if (clientExercises && clientExercises.length > 0) {
              const exerciseName = clientExercises[0].name;
              // Only add if not in avoided exercises
              if (!avoidedExercises.includes(exerciseName)) {
                exercises.push({
                  name: exerciseName,
                  confirmed: true,
                  isExcluded: false,
                  isActive: true
                });
              }
            }
          }
        }
      } else if (workoutData.blueprint.clientExercisePools) {
        // Standard blueprint - for now, just show the placeholder exercises
        // In the future, this would use the actual pre-assigned exercises
        const placeholderExercises = ['Barbell Back Squat', 'Pull-ups'];
        placeholderExercises.forEach(exerciseName => {
          if (!avoidedExercises.includes(exerciseName)) {
            exercises.push({
              name: exerciseName,
              confirmed: true,
              isExcluded: false,
              isActive: true
            });
          }
        });
      }
    }
    
    // Add manually included exercises that aren't in the template
    includeExercises.forEach(includedExercise => {
      // Only add if not already in the list and not excluded
      if (!exercises.find(ex => ex.name === includedExercise) && !avoidedExercises.includes(includedExercise)) {
        exercises.push({
          name: includedExercise,
          confirmed: true,
          isExcluded: false,
          isActive: true
        });
      }
    });
    
    // Filter out excluded exercises - we don't want to show them
    return exercises.filter(ex => !ex.isExcluded);
  };

  // Transform checked-in clients to match the UI structure
  const clients = checkedInClients?.map(client => ({
    id: client.userId,
    name: client.userName || "Unknown Client",
    avatar: client.userId,
    exerciseCount: workoutData?.groupContext?.clients?.find(c => c.user_id === client.userId)?.exercises?.length || 0,
    confirmedExercises: getClientExercisesForRounds(client.userId),
    muscleFocus: client.preferences?.muscleTargets || [],
    avoidance: client.preferences?.muscleLessens || [],
    notes: client.preferences?.notes || [],
    intensity: client.preferences?.intensity || 'moderate',
    workoutType: client.preferences?.sessionGoal || 'full_body',
    includeFinisher: client.preferences?.notes?.includes('include_finisher') || false
  })) || [];

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden relative">
      {/* Full screen loading overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Generating workouts...</p>
            <p className="mt-2 text-sm text-gray-500">This may take a few moments</p>
          </div>
        </div>
      )}
      
      {/* Action Menu - Top Right */}
      <div className="fixed top-4 right-4 z-10">
        {/* Menu Toggle Button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg p-2 space-y-1 min-w-[200px]">
            <button
              onClick={() => {
                router.back();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            
            <button
              onClick={() => {
                generateWorkout();
                setShowMenu(false);
              }}
              disabled={isGenerating || !sessionId}
              className={`w-full px-4 py-2 text-left rounded-md transition-colors flex items-center gap-2 ${
                isGenerating || !sessionId
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-green-600 hover:bg-green-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isGenerating ? 'Generating...' : 'Generate Workouts'}
            </button>
            
            <div className="border-t border-gray-200 my-1"></div>
            
            <button
              onClick={() => {
                if (sessionId) {
                  markAllReady.mutate({ sessionId });
                }
              }}
              disabled={!sessionId || markAllReady.isPending || allClientsReady}
              className={`w-full px-4 py-2 text-left rounded-md transition-colors flex items-center gap-2 ${
                !sessionId || markAllReady.isPending || allClientsReady
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {markAllReady.isPending ? 'Marking Ready...' : allClientsReady ? 'All Clients Ready' : 'Mark All Ready'}
            </button>
            
            <button
              onClick={() => {
                // Check if all clients are ready
                const allReady = checkedInClients?.every(client => client.status === 'ready') ?? false;
                if (!allReady) {
                  alert('All clients must be marked as ready before viewing visualization');
                  return;
                }
                router.push(`/session-lobby/group-visualization?sessionId=${sessionId}`);
                setShowMenu(false);
              }}
              disabled={!checkedInClients?.every(client => client.status === 'ready')}
              className={`w-full px-4 py-2 text-left rounded-md transition-colors flex items-center gap-2 ${
                !checkedInClients?.every(client => client.status === 'ready')
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-purple-600 hover:bg-purple-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Visualization
            </button>
          </div>
        )}
      </div>

      {/* Content - Centered Vertically and Horizontally */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto p-8">
          {/* Client Cards Grid */}
          {clients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
              {clients.map((client) => (
                <div key={client.id} className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm">
                  {/* Client Header */}
                  <div className="p-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.avatar}`}
                        alt={client.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{client.name}</h3>
                        {client.notes.length > 0 && (
                          <p className="text-xs text-gray-500">{client.notes.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Confirm Exercises */}
                  <div className="p-3 border-b border-gray-200 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="space-y-1.5 flex-1">
                      {client.confirmedExercises.map((exercise, idx) => (
                        <ExerciseListItem
                          key={idx}
                          name={exercise.name}
                          isExcluded={exercise.isExcluded}
                          actionButton={
                            <div className={`w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center ${
                              exercise.isActive 
                                ? 'border-green-500 bg-green-500'
                                : 'border-gray-300 bg-gray-100 opacity-50' 
                            }`}>
                              {exercise.isActive && (
                                <CheckIcon className="w-3 h-3 text-white" />
                              )}
                            </div>
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Muscle Focus & Avoidance */}
                  <div className="p-3 border-b border-gray-200 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="flex flex-wrap gap-1">
                        {/* Muscle Target Badges */}
                        {client.muscleFocus.map((muscle, idx) => (
                          <span
                            key={`focus-${idx}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                          >
                            {formatMuscleLabel(muscle)}
                          </span>
                        ))}
                        
                        {/* Limit Badges */}
                        {client.avoidance.map((item, idx) => (
                          <span
                            key={`avoid-${idx}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
                          >
                            {formatMuscleLabel(item)}
                          </span>
                        ))}
                        
                        {/* Empty state */}
                        {client.muscleFocus.length === 0 && client.avoidance.length === 0 && (
                          <span className="text-sm text-gray-700">No muscle preferences</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Workout Focus */}
                  <div className="p-3 border-b border-gray-200 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="flex-1 flex items-center">
                      <span className="text-sm text-gray-700">
                        {client.workoutType === 'targeted' ? 'Targeted' : 'Full Body'}
                        {client.includeFinisher && ' • Finisher'}
                      </span>
                    </div>
                  </div>

                  {/* Section 4: Intensity */}
                  <div className="p-3 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div className="flex-1 flex items-center">
                      <span className="text-sm text-gray-700">
                        {client.intensity === 'low' && 'Low (4 exercises)'}
                        {client.intensity === 'moderate' && 'Moderate (5 exercises)'}
                        {client.intensity === 'high' && 'High (6 exercises)'}
                        {client.intensity === 'intense' && 'Intense (7 exercises)'}
                        {!client.intensity && 'Moderate (5 exercises)'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-500">No clients have checked in to this session yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}