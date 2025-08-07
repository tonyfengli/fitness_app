"use client";

import React, { Suspense, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
// Removed ClientWorkoutCard import - using custom component
import { Button, Icon } from "@acme/ui-shared";
import { useTRPC } from "~/trpc/react";
import { useExerciseSelections } from "~/hooks/useExerciseSelections";

// Constants
const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

// Workout card component that receives exercises as props (no additional fetching)
function WorkoutCard({ workoutData, exercises }: { workoutData: any; exercises: any[] }) {
  const userName = workoutData.user.name || workoutData.user.email.split('@')[0];
  const avatarUrl = `${AVATAR_API_URL}?seed=${encodeURIComponent(userName)}`;
  
  // Get all exercises as a flat list
  const exerciseList = exercises?.map(ex => ({
    id: ex.id,
    name: ex.exercise.name
  })) || [];
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <img
            src={avatarUrl}
            alt={`${userName} avatar`}
            className="w-12 h-12 rounded-full"
          />
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{userName}</h3>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <ol className="space-y-2">
          {exerciseList.map((exercise, index) => (
            <li key={exercise.id} className="flex items-start">
              <span className="text-gray-500 mr-3 mt-0.5">{index + 1}.</span>
              <span className="text-gray-800">{exercise.name}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function WorkoutOverviewContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const trpc = useTRPC();
  
  // Fetch exercise selections instead of workouts
  const { selections, isLoading, error } = useExerciseSelections(sessionId);
  
  // Also fetch client information to get names
  const { data: clientsData } = useQuery({
    ...trpc.auth.getClientsByBusiness.queryOptions(),
    enabled: !!sessionId,
  });
  
  // Transform selections into workout-like structure for display
  // MUST be called before any conditional returns for hooks consistency
  const workouts = React.useMemo(() => {
    if (!selections || !clientsData) return [];
    
    // Group selections by client
    const selectionsByClient = selections.reduce((acc, selection) => {
      if (!acc[selection.clientId]) {
        acc[selection.clientId] = [];
      }
      acc[selection.clientId].push(selection);
      return acc;
    }, {} as Record<string, typeof selections>);
    
    // Create workout-like objects for each client
    return Object.entries(selectionsByClient).map(([clientId, clientSelections]) => {
      const client = clientsData.find(c => c.id === clientId);
      
      return {
        workout: { id: clientId, userId: clientId },
        user: { 
          name: client?.name || client?.email?.split('@')[0] || 'Unknown', 
          email: client?.email || ''
        },
        exercises: clientSelections.map((sel, index) => ({
          id: sel.id,
          exercise: { name: sel.exerciseName }
        }))
      };
    });
  }, [selections, clientsData]);
  
  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">No session ID provided</p>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading workouts...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-red-500">Error loading workouts: {error.message}</p>
      </div>
    );
  }
  
  if (!workouts || workouts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">No exercise selections found for this session</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
      {workouts.map((workoutData) => (
        <WorkoutCard 
          key={workoutData.workout.id} 
          workoutData={workoutData} 
          exercises={workoutData.exercises || []}
        />
      ))}
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
  
  // Start workout mutation
  const startWorkoutMutation = useMutation({
    ...trpc.trainingSession.startWorkout.mutationOptions(),
    onSuccess: (data) => {
      console.log('Workout organized successfully:', data);
      // Navigate to workout-live after successful organization
      router.push(`/workout-live?sessionId=${sessionId}&round=1`);
    },
    onError: (error: any) => {
      console.error('Failed to start workout:', error);
      setIsStarting(false);
      // You might want to show an error toast here
      alert(`Failed to start workout: ${error.message}`);
    }
  });
  
  const handleStartWorkout = async () => {
    if (!sessionId) return;
    
    setIsStarting(true);
    setShowMenu(false);
    
    // Call the startWorkout mutation
    startWorkoutMutation.mutate({ sessionId });
  };
  
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden relative">
      {/* Full screen loading overlay */}
      {isStarting && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Organizing workout...</p>
            <p className="mt-2 text-sm text-gray-500">Setting up rounds and equipment</p>
          </div>
        </div>
      )}
      
      {/* Menu Button - Top Right */}
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
                router.push('/sessions');
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Sessions
            </button>
            
            <button
              onClick={() => {
                router.push(`/session-lobby/group-visualization?sessionId=${sessionId}`);
                setShowMenu(false);
              }}
              disabled={!sessionId}
              className={`w-full px-4 py-2 text-left rounded-md transition-colors flex items-center gap-2 ${
                sessionId
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              Group Visualization
            </button>
            
            <button
              onClick={handleStartWorkout}
              disabled={!sessionId || isStarting}
              className={`w-full px-4 py-2 text-left rounded-md transition-colors flex items-center gap-2 ${
                sessionId && !isStarting
                  ? 'text-blue-600 hover:bg-blue-50'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Start Workout
            </button>
          </div>
        )}
      </div>

      {/* Content - Centered Vertically and Horizontally */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <p className="text-gray-500">Loading...</p>
            </div>
          }>
            <WorkoutOverviewContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutOverview() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <WorkoutOverviewMain />
    </Suspense>
  );
}