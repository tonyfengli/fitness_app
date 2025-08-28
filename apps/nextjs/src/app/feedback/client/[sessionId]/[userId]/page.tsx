"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export default function PostWorkoutFeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionId = params.sessionId as string;
  const userId = params.userId as string;
  const trpc = useTRPC();
  
  // Track loading state for individual exercises
  const [loadingExercises, setLoadingExercises] = useState<Set<string>>(new Set());
  const [hiddenExercises, setHiddenExercises] = useState<Set<string>>(new Set());

  // Log initial params
  console.log("PostWorkoutFeedbackPage - Initial params:", {
    sessionId,
    userId,
    timestamp: new Date().toISOString(),
  });

  // Fetch exercises for feedback
  const { data: feedbackData, isLoading, error } = useQuery({
    ...trpc.postWorkoutFeedback.getExercisesForFeedbackPublic.queryOptions({
      sessionId,
      userId,
    }),
  });

  // Log query state
  console.log("PostWorkoutFeedbackPage - Query state:", {
    isLoading,
    hasError: !!error,
    errorMessage: error?.message,
    hasData: !!feedbackData,
    dataDetails: feedbackData ? {
      exercisesCount: feedbackData.exercises?.length,
      hasExercisesByType: !!feedbackData.exercisesByType,
      swappedCount: feedbackData.exercisesByType?.swapped?.length,
      performedCount: feedbackData.exercisesByType?.performed?.length,
    } : null,
    timestamp: new Date().toISOString(),
  });

  // Log the full data if available
  if (feedbackData) {
    console.log("PostWorkoutFeedbackPage - Full feedbackData:", feedbackData);
  }

  // Mutation for setting exercise rating
  const setRatingMutation = useMutation({
    mutationFn: async ({ exerciseId, ratingType }: { exerciseId: string; ratingType: "favorite" | "avoid" }) => {
      const response = await fetch('/api/trpc/exercise.setRating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          json: {
            userId,
            exerciseId,
            ratingType,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to set rating');
      }
      
      const result = await response.json();
      return result.result?.data?.json;
    },
    onMutate: async ({ exerciseId }) => {
      // Add to loading state
      setLoadingExercises(prev => new Set(prev).add(exerciseId));
    },
    onSuccess: async (data, { exerciseId }) => {
      // Hide the card
      setHiddenExercises(prev => new Set(prev).add(exerciseId));
      // Remove from loading state
      setLoadingExercises(prev => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
      // Invalidate the query to refresh data
      await queryClient.invalidateQueries({
        queryKey: ['postWorkoutFeedback.getExercisesForFeedbackPublic', { sessionId, userId }],
      });
    },
    onError: (error, { exerciseId }) => {
      // Remove from loading state
      setLoadingExercises(prev => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
      console.error('Failed to save rating:', error);
    },
  });

  // Handle button clicks
  const handleRating = (exerciseId: string, ratingType: "favorite" | "avoid" | "maybe_later") => {
    if (ratingType === "maybe_later") {
      // Just hide the card, don't save to backend
      setHiddenExercises(prev => new Set(prev).add(exerciseId));
    } else {
      // Save to backend
      setRatingMutation.mutate({ exerciseId, ratingType });
    }
  };

  // Get client info for display
  const clientName = feedbackData?.exercisesByType ? 
    (feedbackData.exercises[0]?.exerciseName ? "Client" : "Client") : 
    "Client";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading feedback questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Error Loading Feedback</h1>
          <p className="mt-2 text-gray-600">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  if (!feedbackData || feedbackData.exercises.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">All Done!</h1>
          <p className="text-gray-600 mb-6">
            You've already provided feedback for all exercises in this workout.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { swapped, performed } = feedbackData.exercisesByType;
  const totalExercises = feedbackData.exercises.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md p-4 pb-20">
        {/* Client info */}
        <div className="mb-6 mt-4 flex items-center justify-center">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`}
            alt="Client"
            className="mr-3 h-10 w-10 rounded-full"
          />
          <h2 className="text-lg font-semibold text-gray-900">
            Post-Workout Feedback
          </h2>
        </div>


        {/* All Exercises */}
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              All Exercises ({totalExercises})
            </h4>
            <div className="space-y-2">
              {feedbackData.exercises
                .filter(exercise => !hiddenExercises.has(exercise.exerciseId))
                .map((exercise) => {
                  const isLoading = loadingExercises.has(exercise.exerciseId);
                  
                  return (
                    <div
                      key={exercise.exerciseId}
                      className={`p-4 bg-white border border-gray-200 rounded-lg shadow-sm transition-opacity ${
                        isLoading ? 'opacity-50' : 'opacity-100'
                      }`}
                    >
                  <div className="font-medium text-gray-900 mb-3">
                    {exercise.exerciseName}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRating(exercise.exerciseId, 'favorite')}
                      disabled={isLoading}
                      className={`flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg transition-colors ${
                        isLoading 
                          ? 'cursor-not-allowed opacity-50' 
                          : 'hover:bg-green-50 hover:border-green-300'
                      }`}
                      aria-label="Like exercise"
                    >
                      <svg className="w-5 h-5 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRating(exercise.exerciseId, 'avoid')}
                      disabled={isLoading}
                      className={`flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg transition-colors ${
                        isLoading 
                          ? 'cursor-not-allowed opacity-50' 
                          : 'hover:bg-red-50 hover:border-red-300'
                      }`}
                      aria-label="Dislike exercise"
                    >
                      <svg className="w-5 h-5 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRating(exercise.exerciseId, 'maybe_later')}
                      disabled={isLoading}
                      className={`flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg transition-colors ${
                        isLoading 
                          ? 'cursor-not-allowed opacity-50' 
                          : 'hover:bg-yellow-50 hover:border-yellow-300'
                      }`}
                      aria-label="Not sure"
                    >
                      <span className="text-sm font-medium text-gray-600">Not Sure</span>
                    </button>
                  </div>
                </div>
                  );
                })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}