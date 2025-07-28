"use client";

import React, { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
// Removed ClientWorkoutCard import - using custom component
import { Button, Icon } from "@acme/ui-shared";
import { useTRPC } from "~/trpc/react";

// Constants
const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

// Workout card component that receives exercises as props (no additional fetching)
function WorkoutCard({ workoutData, exercises }: { workoutData: any; exercises: any[] }) {
  const userName = workoutData.user.name || workoutData.user.email.split('@')[0];
  const avatarUrl = `${AVATAR_API_URL}?seed=${encodeURIComponent(userName)}`;
  
  // Group exercises by their groupName (e.g., Round 1, Round 2, Block A, etc.)
  const exercisesByGroup = exercises?.reduce((acc, ex) => {
    const groupName = ex.groupName || 'Exercises';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push({
      id: ex.id,
      name: ex.exercise.name,
      sets: ex.setsCompleted,
    });
    return acc;
  }, {} as Record<string, Array<{id: string, name: string, sets: number}>>) || {};
  
  // Sort groups by natural order (Round 1 before Round 2, Block A before Block B, etc.)
  const sortedGroups = Object.entries(exercisesByGroup).sort((a, b) => {
    // Extract numbers from group names for natural sorting
    const getNumericValue = (str: string) => {
      const match = str.match(/\d+/);
      return match ? parseInt(match[0]) : 999;
    };
    
    // First sort by the text part, then by numeric part
    const aText = a[0].replace(/\d+/g, '');
    const bText = b[0].replace(/\d+/g, '');
    
    if (aText !== bText) {
      return aText.localeCompare(bText);
    }
    
    return getNumericValue(a[0]) - getNumericValue(b[0]);
  });
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <img
            src={avatarUrl}
            alt={`${userName} avatar`}
            className="w-12 h-12 rounded-full"
          />
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{userName}</h3>
            <p className="text-sm text-gray-500">
              {workoutData.exerciseCount} exercises
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {sortedGroups.map(([groupName, exercises], index) => (
          <div key={groupName}>
            {index > 0 && <div className="border-t border-gray-200 my-4" />}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm uppercase tracking-wider">
                {groupName}
              </h4>
              <div className="space-y-2">
                {exercises.map((exercise) => (
                  <div key={exercise.id} className="flex items-center justify-between py-2">
                    <span className="text-gray-800">{exercise.name}</span>
                    <span className="text-sm text-gray-500 font-medium">
                      {exercise.sets} sets
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkoutOverviewContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const trpc = useTRPC();
  
  // Fetch workouts with exercises in a single query
  const { data: workouts, isLoading, error } = useQuery({
    ...trpc.workout.sessionWorkoutsWithExercises.queryOptions({ sessionId: sessionId || "" }),
    enabled: !!sessionId,
  });
  
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
        <p className="text-gray-500">No workouts found for this session</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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

export default function WorkoutOverview() {
  const router = useRouter();
  
  return (
    <div className="absolute inset-0 bg-gray-50 text-gray-800 overflow-y-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10">
          <Button
            onClick={() => router.push('/sessions')}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <Icon name="arrow_back" size={20} />
            Back to Sessions
          </Button>
        </div>

        <main>
          <h1 className="text-5xl font-bold mb-12 text-gray-900">Workout Overview</h1>
          
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <p className="text-gray-500">Loading...</p>
            </div>
          }>
            <WorkoutOverviewContent />
          </Suspense>
        </main>
      </div>
    </div>
  );
}