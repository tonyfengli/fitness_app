"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
  const [generationProgress, setGenerationProgress] = useState<{
    isGenerating: boolean;
    currentStep: string;
    error: string | null;
  }>({
    isGenerating: false,
    currentStep: '',
    error: null
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
        console.error('Failed to mark all clients ready:', error);
        alert('Failed to mark all clients ready. Please try again.');
      }
    })
  );
  
  // Blueprint generation state and function
  const [shouldGenerate, setShouldGenerate] = useState(false);
  
  // Blueprint generation query
  const { refetch: generateBlueprint } = useQuery({
    ...trpc.trainingSession.generateGroupWorkoutBlueprint.queryOptions({ 
      sessionId: sessionId || '',
      options: { includeDiagnostics: true }
    }),
    enabled: false // Only run when we manually trigger it
  });
  
  // Save visualization data mutation
  const saveVisualization = useMutation(
    trpc.trainingSession.saveVisualizationData.mutationOptions()
  );
  
  // Handler for View Visualization button
  const handleGenerateAndNavigate = async () => {
    if (!sessionId) return;
    
    setGenerationProgress({
      isGenerating: true,
      currentStep: 'Generating blueprint...',
      error: null
    });
    setShowMenu(false);
    
    try {
      // Step 1: Generate blueprint with LLM
      setGenerationProgress(prev => ({ ...prev, currentStep: 'Generating blueprint...' }));
      const { data: result } = await generateBlueprint();
      
      // Step 2: Check if LLM result exists
      if (!result || !result.llmResult || result.llmResult.error) {
        throw new Error('Failed to generate exercise selections');
      }
      
      setGenerationProgress(prev => ({ ...prev, currentStep: 'Saving exercise selections...' }));
      
      // Step 3: Save the visualization data
      if (result && sessionId) {
        // Log what we're about to save
        console.log('💾 PREFERENCES: About to save visualization data:', {
          hasBlueprint: !!result.blueprint,
          hasClientPools: !!result.blueprint?.clientExercisePools,
          clientPoolKeys: result.blueprint?.clientExercisePools ? Object.keys(result.blueprint.clientExercisePools) : [],
          hasBucketedSelections: result.blueprint?.clientExercisePools ? 
            Object.entries(result.blueprint.clientExercisePools).map(([clientId, pool]: [string, any]) => ({
              clientId,
              hasBucketedSelection: !!pool.bucketedSelection,
              bucketedCount: pool.bucketedSelection?.exercises?.length || 0
            })) : []
        });
        
        await saveVisualization.mutateAsync({
          sessionId,
          visualizationData: {
            blueprint: result.blueprint,
            groupContext: result.groupContext,
            llmResult: result.llmResult,
            summary: result.summary,
            exerciseMetadata: result.blueprint?.clientExercisePools || undefined,
            sharedExerciseIds: result.blueprint?.sharedExercisePool?.map((e: any) => e.id) || undefined
          }
        });
      }
      
      // Small delay to show the final step
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 4: Navigate to exercise selection page
      router.push(`/workout-overview?sessionId=${sessionId}&userId=${checkedInClients?.[0]?.userId}`);
      
    } catch (error) {
      console.error('Generation failed:', error);
      setGenerationProgress({
        isGenerating: false,
        currentStep: '',
        error: error instanceof Error ? error.message : 'Failed to generate workout'
      });
    }
  };
  
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
  
  const isLoading = clientsLoading;
  
  // Handle realtime preference updates
  const handlePreferenceUpdate = useCallback((update: any) => {
    // Invalidate the checked-in clients query to refetch the latest data
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey as any[];
        return queryKey[0]?.[0] === 'trainingSession' && 
               queryKey[0]?.[1] === 'getCheckedInClients' &&
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
    exerciseCount: client.preferences?.includeExercises?.length || 0,
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
                handleGenerateAndNavigate();
              }}
              disabled={!checkedInClients?.every(client => client.status === 'ready') || generationProgress.isGenerating}
              className={`w-full px-4 py-2 text-left rounded-md transition-colors flex items-center gap-2 ${
                !checkedInClients?.every(client => client.status === 'ready') || generationProgress.isGenerating
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-purple-600 hover:bg-purple-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {generationProgress.isGenerating ? 'Generating...' : 'View Visualization'}
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
      
      {/* Progress Modal */}
      {generationProgress.isGenerating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-lg font-semibold text-gray-900 mb-2">Generating Workout</p>
              <p className="text-sm text-gray-600 text-center">{generationProgress.currentStep}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Error Modal */}
      {generationProgress.error && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setGenerationProgress(prev => ({ ...prev, error: null }))}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">Generation Failed</p>
              <p className="text-sm text-gray-600 text-center mb-4">{generationProgress.error}</p>
              <button
                onClick={() => setGenerationProgress(prev => ({ ...prev, error: null }))}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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