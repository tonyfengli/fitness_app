"use client";

import React, { useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimePreferences } from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";

// Helper function to format muscle values to display labels
const formatMuscleLabel = (muscleValue: string): string => {
  const muscleMap: Record<string, string> = {
    // Lower Body
    'glutes': 'Glutes',
    'quads': 'Quads',
    'hamstrings': 'Hamstrings',
    'calves': 'Calves',
    'adductors': 'Adductors',
    'abductors': 'Abductors',
    'shins': 'Shins',
    'tibialis_anterior': 'Tibialis Anterior',
    // Core
    'core': 'Core',
    'lower_abs': 'Lower Abs',
    'upper_abs': 'Upper Abs',
    'obliques': 'Obliques',
    // Upper Body - Push
    'chest': 'Chest',
    'upper_chest': 'Upper Chest',
    'lower_chest': 'Lower Chest',
    'shoulders': 'Shoulders',
    'delts': 'Delts',
    'triceps': 'Triceps',
    // Upper Body - Pull
    'lats': 'Lats',
    'upper_back': 'Upper Back',
    'lower_back': 'Lower Back',
    'traps': 'Traps',
    'biceps': 'Biceps'
  };
  return muscleMap[muscleValue] || muscleValue;
};

// Icon components as inline SVGs
const Check = () => (
  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);


export default function PreferencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
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

  // Fetch workout blueprint to get exercise selections
  const { data: workoutData, isLoading: workoutLoading, refetch: refetchWorkout } = useQuery(
    sessionId ? trpc.trainingSession.visualizeGroupWorkout.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ["disabled"],
      queryFn: () => Promise.resolve(null)
    }
  );

  const isLoading = clientsLoading || workoutLoading;
  
  // Handle realtime preference updates
  const handlePreferenceUpdate = useCallback((update: any) => {
    // Invalidate both queries at once to refetch the latest data
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey as any[];
        return queryKey[0]?.[0] === 'trainingSession' && 
               (queryKey[0]?.[1] === 'getCheckedInClients' || queryKey[0]?.[1] === 'visualizeGroupWorkout') &&
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
    
    // If no includeExercises, fall back to blueprint exercises
    if (exercises.length === 0 && workoutData?.blueprint) {
      const rounds = ['Round1', 'Round2'];
      for (const round of rounds) {
        const block = workoutData.blueprint.blocks.find(b => b.blockId === round);
        if (block && block.individualCandidates && block.individualCandidates[clientId]) {
          const clientExercises = block.individualCandidates[clientId].exercises;
          if (clientExercises && clientExercises.length > 0) {
            const exerciseName = clientExercises[0].name;
            exercises.push({
              name: exerciseName,
              confirmed: !avoidedExercises.includes(exerciseName),
              isExcluded: avoidedExercises.includes(exerciseName),
              isActive: !avoidedExercises.includes(exerciseName)
            });
          }
        }
      }
    }
    
    // Add excluded exercises that were replaced
    avoidedExercises.forEach(excludedExercise => {
      // Only add if it's not already in the active list
      if (!exercises.find(ex => ex.name === excludedExercise)) {
        exercises.push({
          name: excludedExercise,
          confirmed: false,
          isExcluded: true,
          isActive: false
        });
      }
    });
    
    // Add manually included exercises that aren't in the template
    includeExercises.forEach(includedExercise => {
      // Only add if not already in the list
      if (!exercises.find(ex => ex.name === includedExercise)) {
        exercises.push({
          name: includedExercise,
          confirmed: true,
          isExcluded: false,
          isActive: true
        });
      }
    });
    
    return exercises;
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
    notes: client.preferences?.notes || []
  })) || [];

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Workout Preferences</h1>
                <p className="mt-2 text-gray-600">
                  {clients.length} client{clients.length !== 1 ? 's' : ''} in session
                </p>
              </div>
            </div>
          </div>

          {/* Client Cards Grid */}
          {clients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
            <div key={client.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Client Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.avatar}`}
                    alt={client.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    <p className="text-sm text-gray-500">{client.exerciseCount} exercises</p>
                  </div>
                </div>
              </div>

              {/* Section 1: Confirm Exercises */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <h4 className="font-medium text-gray-900">Confirm Exercises</h4>
                </div>
                <div className="space-y-3">
                  {client.confirmedExercises.map((exercise, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${
                      exercise.isExcluded ? 'bg-gray-100' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`${
                          exercise.isExcluded 
                            ? 'text-gray-400 line-through decoration-2' 
                            : 'text-gray-700'
                        }`}>{exercise.name}</span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 transition-colors flex items-center justify-center ${
                        exercise.isActive 
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300 bg-gray-100 opacity-50' 
                      }`}>
                        {exercise.isActive && (
                          <Check />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Muscle Focus & Avoidance */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <h4 className="font-medium text-gray-900">Muscle Target & Limit</h4>
                </div>
                <div className="space-y-3">
                  {/* Muscle Target Items */}
                  {client.muscleFocus.map((muscle, idx) => (
                    <div key={`focus-${idx}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-blue-700 font-medium">Target: {formatMuscleLabel(muscle)}</span>
                    </div>
                  ))}
                  
                  {/* Limit Items */}
                  {client.avoidance.map((item, idx) => (
                    <div key={`avoid-${idx}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="text-red-700 font-medium">Limit: {formatMuscleLabel(item)}</span>
                    </div>
                  ))}
                  
                  {/* Empty state */}
                  {client.muscleFocus.length === 0 && client.avoidance.length === 0 && (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-sm">No muscle preferences set</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Other Notes */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <h4 className="font-medium text-gray-900">Other Notes</h4>
                </div>
                <div className="space-y-3">
                  {/* Display notes */}
                  {client.notes.map((note, idx) => (
                    <div key={`note-${idx}`} className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">{note}</span>
                    </div>
                  ))}
                  
                  {/* Empty state */}
                  {client.notes.length === 0 && (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-sm">No notes added</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No clients have checked in to this session yet.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 mb-24 flex justify-between">
          <button
            onClick={() => router.push(`/session-lobby/group-visualization?sessionId=${sessionId}`)}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            View Visualization
          </button>
          
          <button
            onClick={() => router.back()}
            className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Back
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}