"use client";

import React, { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

// Icon components as inline SVGs
const Check = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const X = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Plus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

export default function PreferencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const trpc = useTRPC();

  // Fetch checked-in clients for the session
  const { data: checkedInClients, isLoading: clientsLoading, refetch: refetchClients } = useQuery(
    sessionId ? trpc.trainingSession.getCheckedInClients.queryOptions({ sessionId }) : {
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
  
  // Refetch data on mount to ensure fresh data
  React.useEffect(() => {
    if (sessionId) {
      console.log('[Preferences] Refetching data for session:', sessionId);
      refetchClients();
      refetchWorkout();
    }
  }, [sessionId, refetchClients, refetchWorkout]);

  const isLoading = clientsLoading || workoutLoading;
  
  // SSE removed - will be replaced with Supabase Realtime
  
  // Debug logging
  React.useEffect(() => {
    console.log('[Preferences] Component state:', {
      sessionId,
      isLoading,
      clientsLoading,
      workoutLoading,
      checkedInClientsCount: checkedInClients?.length || 0,
      hasWorkoutData: !!workoutData,
      sseConnected: false // SSE removed
    });
  }, [sessionId, isLoading, clientsLoading, workoutLoading, checkedInClients, workoutData]);

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

  // Helper function to get exercises for a client from specific rounds
  const getClientExercisesForRounds = (clientId: string, rounds: string[]) => {
    if (!workoutData?.blueprint) return [];
    
    // Get the client's preferences to check for excluded exercises
    const clientData = checkedInClients?.find(c => c.userId === clientId);
    const avoidedExercises = clientData?.preferences?.avoidExercises || [];
    
    const exercises: { name: string; confirmed: boolean; isExcluded: boolean }[] = [];
    
    for (const round of rounds) {
      const block = workoutData.blueprint.blocks.find(b => b.blockId === round);
      if (block && block.individualCandidates && block.individualCandidates[clientId]) {
        const clientExercises = block.individualCandidates[clientId].exercises;
        if (clientExercises && clientExercises.length > 0) {
          // Get the top exercise for this round (deterministically selected)
          const exerciseName = clientExercises[0].name;
          exercises.push({
            name: exerciseName,
            confirmed: false,
            isExcluded: avoidedExercises.includes(exerciseName)
          });
        }
      }
    }
    
    return exercises;
  };

  // Transform checked-in clients to match the UI structure
  const clients = checkedInClients?.map(client => ({
    id: client.userId,
    name: client.userName || "Unknown Client",
    avatar: client.userId,
    exerciseCount: workoutData?.groupContext?.clients?.find(c => c.user_id === client.userId)?.exercises?.length || 0,
    confirmedExercises: getClientExercisesForRounds(client.userId, ['Round1', 'Round2']),
    muscleFocus: [],
    avoidance: []
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
                        {exercise.isExcluded && (
                          <span className="text-xs text-gray-500 italic">(Replaced)</span>
                        )}
                      </div>
                      <button className={`w-6 h-6 rounded-full border-2 bg-white transition-colors ${
                        exercise.isExcluded 
                          ? 'border-gray-300 cursor-not-allowed opacity-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`} disabled={exercise.isExcluded}>
                        {/* Empty circle for unselected state */}
                      </button>
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
                  <h4 className="font-medium text-gray-900">Muscle Focus & Avoidance</h4>
                </div>
                <div className="space-y-3">
                  {/* Muscle Focus Items */}
                  {client.muscleFocus.map((muscle, idx) => (
                    <div key={`focus-${idx}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-blue-700 font-medium">Focus: {muscle}</span>
                      <button className="text-gray-400 hover:text-gray-600">
                        <X />
                      </button>
                    </div>
                  ))}
                  
                  {/* Avoidance Items */}
                  {client.avoidance.map((item, idx) => (
                    <div key={`avoid-${idx}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="text-red-700 font-medium">Avoid: {item}</span>
                      <button className="text-gray-400 hover:text-gray-600">
                        <X />
                      </button>
                    </div>
                  ))}
                  
                  {/* Add button if no items or has items */}
                  {(client.muscleFocus.length === 0 && client.avoidance.length === 0) ? (
                    <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                      <Plus />
                      Add Focus or Avoidance
                    </button>
                  ) : (
                    <button className="w-full p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 flex items-center justify-center gap-2">
                      <Plus />
                      Add More
                    </button>
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
                  <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                    <Plus />
                    Add Note
                  </button>
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