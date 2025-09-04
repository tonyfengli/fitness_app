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
  // Track exercise weights locally
  const [exerciseWeights, setExerciseWeights] = useState<Record<string, number>>({});
  // Track expanded cards
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Log initial params
  // Only log on mount, not every render
  React.useEffect(() => {
    console.log("PostWorkoutFeedbackPage - Initial params:", {
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }, [sessionId, userId]);

  // Fetch exercises for feedback
  const feedbackQuery = trpc.postWorkoutFeedback.getExercisesForFeedbackPublic.queryOptions({
    sessionId,
    userId,
  });
  const { data: feedbackData, isLoading, error } = useQuery(feedbackQuery);

  // Initialize weights from fetched data
  React.useEffect(() => {
    if (feedbackData?.exercises) {
      const initialWeights: Record<string, number> = {};
      feedbackData.exercises.forEach((exercise: any) => {
        if (exercise.latestWeight) {
          initialWeights[exercise.exerciseId] = exercise.latestWeight;
        }
      });
      setExerciseWeights(prev => ({
        ...initialWeights,
        ...prev, // Preserve any user edits
      }));
    }
  }, [feedbackData]);

  // Log query state only when it changes
  React.useEffect(() => {
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
  }, [isLoading, error, feedbackData]);

  // We don't need a separate ratings query anymore since ratings come with the exercises

  // Get the query key for optimistic updates
  const queryKey = trpc.postWorkoutFeedback.getExercisesForFeedbackPublic.queryOptions({
    sessionId,
    userId,
  }).queryKey;

  // Mutation for setting exercise rating with optimistic updates
  const setRatingMutation = useMutation({
    mutationFn: async ({ exerciseId, ratingType }: { exerciseId: string; ratingType: "favorite" | "avoid" | "not_sure" }) => {
      // Map "not_sure" to "maybe_later" for the backend
      const backendRatingType = ratingType === "not_sure" ? "maybe_later" : ratingType;
      
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
            ratingType: backendRatingType,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to set rating');
      }
      
      const result = await response.json();
      return result.result?.data?.json;
    },
    onMutate: async ({ exerciseId, ratingType }) => {
      // Add to loading state
      setLoadingExercises(prev => new Set(prev).add(exerciseId));
      
      // Cancel any outgoing refetches using the exact query key from tRPC
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically update the cache
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        // Map the frontend rating type to backend
        const backendRatingType = ratingType === "not_sure" ? "maybe_later" : ratingType;
        
        // Update the exercises array with the new rating
        const updatedExercises = old.exercises.map((exercise: any) => {
          if (exercise.exerciseId === exerciseId) {
            return {
              ...exercise,
              existingRating: backendRatingType,
            };
          }
          return exercise;
        });
        
        return {
          ...old,
          exercises: updatedExercises,
          exercisesByType: {
            swapped: updatedExercises.filter((e: any) => e.feedbackType === "swapped_out"),
            performed: updatedExercises.filter((e: any) => e.feedbackType === "performed"),
          },
        };
      });
      
      // Return context for rollback
      return { previousData, exerciseId };
    },
    onSuccess: (data, { exerciseId }) => {
      // Remove from loading state
      setLoadingExercises(prev => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
    },
    onError: (error, { exerciseId }, context) => {
      // Remove from loading state
      setLoadingExercises(prev => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
      
      // Rollback the optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      console.error('Failed to save rating:', error);
    },
    onSettled: () => {
      // Optional: Invalidate and refetch to ensure consistency
      // But with optimistic updates, this is usually not needed
      // queryClient.invalidateQueries({
      //   queryKey: ['postWorkoutFeedback', 'getExercisesForFeedbackPublic', { sessionId, userId }],
      // });
    },
  });

  // Mutation for saving exercise performance (weight)
  const savePerformanceMutation = useMutation({
    mutationFn: async ({ exerciseId, weightLbs }: { exerciseId: string; weightLbs: number }) => {
      const response = await fetch('/api/trpc/postWorkoutFeedback.saveExercisePerformance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          json: {
            sessionId,
            userId,
            exerciseId,
            weightLbs,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save performance');
      }
      
      const result = await response.json();
      return result.result?.data?.json;
    },
    onMutate: async ({ exerciseId, weightLbs }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically update
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        // Update the exercises array with new performance data
        const updatedExercises = old.exercises.map((exercise: any) => {
          if (exercise.exerciseId === exerciseId) {
            return {
              ...exercise,
              latestWeight: weightLbs,
              // We don't know if it's a PR yet, so keep existing value
              isPersonalRecord: exercise.isPersonalRecord,
              previousBestWeight: exercise.previousBestWeight,
            };
          }
          return exercise;
        });
        
        return {
          ...old,
          exercises: updatedExercises,
          exercisesByType: {
            swapped: updatedExercises.filter((e: any) => e.feedbackType === "swapped_out"),
            performed: updatedExercises.filter((e: any) => e.feedbackType === "performed"),
          },
        };
      });
      
      return { previousData, exerciseId, weightLbs };
    },
    onSuccess: (data, { exerciseId }) => {
      console.log(`[Performance] Saved weight for exercise ${exerciseId}:`, data);
      
      // Update with actual PR status from server
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        const updatedExercises = old.exercises.map((exercise: any) => {
          if (exercise.exerciseId === exerciseId) {
            return {
              ...exercise,
              isPersonalRecord: data.isNewRecord,
              previousBestWeight: data.previousBest,
            };
          }
          return exercise;
        });
        
        return {
          ...old,
          exercises: updatedExercises,
          exercisesByType: {
            swapped: updatedExercises.filter((e: any) => e.feedbackType === "swapped_out"),
            performed: updatedExercises.filter((e: any) => e.feedbackType === "performed"),
          },
        };
      });
      
      // Collapse the card after successful save
      setExpandedCards(prev => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
      
      // Show success indicator (the weight value acts as saved indicator)
      if (data.isNewRecord) {
        console.log(`[Performance] New PR! Previous best: ${data.previousBest} lbs`);
      }
    },
    onError: (error, { exerciseId }, context) => {
      console.error('Failed to save performance:', error);
      
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      // Keep the card expanded on error so user can retry
    },
  });

  // Handle button clicks
  const handleRating = (exerciseId: string, ratingType: "favorite" | "avoid" | "not_sure") => {
    // Always save to backend
    setRatingMutation.mutate({ exerciseId, ratingType });
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
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Create a map of exercise ratings from the exercises data
  const exerciseRatings = new Map<string, string>();
  feedbackData.exercises.forEach((exercise: any) => {
    if (exercise.existingRating) {
      // Map "maybe_later" from backend to "not_sure" for frontend
      const displayRatingType = exercise.existingRating === "maybe_later" ? "not_sure" : exercise.existingRating;
      exerciseRatings.set(exercise.exerciseId, displayRatingType);
    }
  });

  // Separate exercises into rated and unrated
  const unratedExercises = feedbackData.exercises.filter(
    (exercise: any) => !exercise.existingRating
  );
  const ratedExercisesList = feedbackData.exercises.filter(
    (exercise: any) => exercise.existingRating
  );

  // Separate component for weight controls to prevent re-animation
  const WeightControls = React.memo(({ 
    exerciseId, 
    exerciseName,
    savePerformanceMutation,
    exercise
  }: { 
    exerciseId: string; 
    exerciseName: string;
    savePerformanceMutation: any;
    exercise: any;
  }) => {
    const weight = exerciseWeights[exerciseId] || 0;
    
    const handleIncrement = () => {
      console.log('[Weight Slider] Increment clicked, current weight:', weight);
      const newWeight = Math.min(weight + 5, 300);
      console.log('[Weight Slider] Setting new weight:', newWeight);
      setExerciseWeights(prev => ({
        ...prev,
        [exerciseId]: newWeight
      }));
    };
    
    const handleDecrement = () => {
      console.log('[Weight Slider] Decrement clicked, current weight:', weight);
      const newWeight = Math.max(weight - 5, 0);
      console.log('[Weight Slider] Setting new weight:', newWeight);
      setExerciseWeights(prev => ({
        ...prev,
        [exerciseId]: newWeight
      }));
    };
    
    const handleSaveWeight = () => {
      console.log(`[Weight Slider] Saving weight for ${exerciseName}: ${weight} lbs`);
      
      // Call the save mutation
      savePerformanceMutation.mutate({ 
        exerciseId, 
        weightLbs: weight 
      });
    };
    
    return (
      <div className="pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 font-medium">Weight</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{weight} lbs</span>
            {/* Show saved status if weight has been previously saved */}
            {exercise?.latestWeight && exercise?.latestWeight === weight && !savePerformanceMutation.isSuccess && (
              exercise?.isPersonalRecord ? (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                  🏆 PR!
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Saved
                </span>
              )
            )}
            {/* Show save status for new saves */}
            {savePerformanceMutation.isSuccess && savePerformanceMutation.variables?.exerciseId === exerciseId && (
              savePerformanceMutation.data?.isNewRecord ? (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                  🏆 New PR!
                </span>
              ) : (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Saved
                </span>
              )
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          {/* Visual progress bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
              style={{ width: `${Math.min((weight / 300) * 100, 100)}%` }}
            />
          </div>
          
          {/* Control buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDecrement}
              className="flex-1 py-3 px-3 bg-gray-100 active:bg-gray-300 active:scale-95 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 border border-gray-200"
              aria-label="Decrease weight"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              <span className="text-sm font-semibold text-gray-700">5 lbs</span>
            </button>
            
            <button
              onClick={handleIncrement}
              className="flex-1 py-3 px-3 bg-gray-100 active:bg-gray-300 active:scale-95 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 border border-gray-200"
              aria-label="Increase weight"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
              <span className="text-sm font-semibold text-gray-700">5 lbs</span>
            </button>
            
            <button
              onClick={handleSaveWeight}
              disabled={savePerformanceMutation.isPending && savePerformanceMutation.variables?.exerciseId === exerciseId}
              className={`px-4 py-3 text-white text-sm font-semibold rounded-lg shadow-sm transition-all ${
                savePerformanceMutation.isPending && savePerformanceMutation.variables?.exerciseId === exerciseId
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 active:bg-indigo-800 active:scale-95'
              }`}
            >
              {savePerformanceMutation.isPending && savePerformanceMutation.variables?.exerciseId === exerciseId 
                ? 'Saving...' 
                : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  });
  
  WeightControls.displayName = 'WeightControls';

  // Component to render exercise card - Memoized to prevent re-renders
  const ExerciseCard = React.memo(({ exercise, currentRating }: { exercise: any; currentRating?: string }) => {
    const isLoading = loadingExercises.has(exercise.exerciseId);
    const isExpanded = expandedCards.has(exercise.exerciseId);
    
    const toggleExpanded = () => {
      setExpandedCards(prev => {
        const next = new Set(prev);
        if (next.has(exercise.exerciseId)) {
          next.delete(exercise.exerciseId);
        } else {
          next.add(exercise.exerciseId);
        }
        return next;
      });
    };
    
    return (
      <div
        key={exercise.exerciseId}
        className={`p-4 bg-white border border-gray-200 rounded-lg shadow-sm transition-all ${
          isLoading ? 'opacity-50' : 'opacity-100'
        }`}
      >
        <div className="font-medium text-gray-900 mb-3">
          {exercise.exerciseName}
        </div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => handleRating(exercise.exerciseId, 'favorite')}
            disabled={isLoading}
            className={`flex-1 p-3 border rounded-lg transition-all ${
              currentRating === 'favorite'
                ? 'bg-green-100 border-green-500 text-green-700'
                : 'bg-gray-50 border-gray-200'
            } ${isLoading ? 'cursor-not-allowed' : ''}`}
            aria-label="Like exercise"
          >
            <svg 
              className={`w-5 h-5 mx-auto ${
                currentRating === 'favorite' ? 'text-green-600' : 'text-gray-600'
              }`} 
              fill={currentRating === 'favorite' ? 'currentColor' : 'none'} 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </button>
          <button
            onClick={() => handleRating(exercise.exerciseId, 'avoid')}
            disabled={isLoading}
            className={`flex-1 p-3 border rounded-lg transition-all ${
              currentRating === 'avoid'
                ? 'bg-red-100 border-red-500 text-red-700'
                : 'bg-gray-50 border-gray-200'
            } ${isLoading ? 'cursor-not-allowed' : ''}`}
            aria-label="Dislike exercise"
          >
            <svg 
              className={`w-5 h-5 mx-auto ${
                currentRating === 'avoid' ? 'text-red-600' : 'text-gray-600'
              }`} 
              fill={currentRating === 'avoid' ? 'currentColor' : 'none'} 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </button>
          <button
            onClick={() => handleRating(exercise.exerciseId, 'not_sure')}
            disabled={isLoading}
            className={`flex-1 p-3 border rounded-lg transition-all ${
              currentRating === 'not_sure'
                ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                : 'bg-gray-50 border-gray-200'
            } ${isLoading ? 'cursor-not-allowed' : ''}`}
            aria-label="Not sure"
          >
            <span className={`text-sm font-medium ${
              currentRating === 'not_sure' ? 'text-yellow-700' : 'text-gray-600'
            }`}>Not Sure</span>
          </button>
        </div>
        
        {/* Expand/Collapse button */}
        <button
          onClick={toggleExpanded}
          className="w-full py-2 mt-3 text-sm text-gray-500 font-medium flex items-center justify-center gap-1 border-t border-gray-100 transition-colors"
        >
          {isExpanded ? (
            <>
              <span>Hide</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </>
          ) : (
            <>
              {exerciseWeights[exercise.exerciseId] ? (
                <span className="flex items-center gap-2">
                  <span className="text-gray-900 font-semibold">{exerciseWeights[exercise.exerciseId]} lbs</span>
                  <span className="text-gray-400">•</span>
                  <span>Update</span>
                </span>
              ) : (
                <span>New Record</span>
              )}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
        
        {/* Weight Section - Only visible when expanded */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <WeightControls 
            exerciseId={exercise.exerciseId} 
            exerciseName={exercise.exerciseName}
            savePerformanceMutation={savePerformanceMutation}
            exercise={exercise}
          />
        </div>
      </div>
    );
  });

  // Give the component a display name for debugging
  ExerciseCard.displayName = 'ExerciseCard';

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


        {/* Rate These Exercises Section */}
        <div className="space-y-6">
          {unratedExercises.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Rate These Exercises ({unratedExercises.length})
              </h4>
              <div className="space-y-2">
                {unratedExercises.map((exercise) => (
                  <ExerciseCard 
                    key={exercise.exerciseId}
                    exercise={exercise} 
                    currentRating={undefined}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                <svg className="w-12 h-12 mx-auto text-green-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All exercises have been rated!</h3>
                <p className="text-gray-600">You can update your ratings below if needed.</p>
              </div>
            </div>
          )}

          {/* Already Rated Section */}
          {ratedExercisesList.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Already Rated ({ratedExercisesList.length})
              </h4>
              <div className="space-y-2">
                {ratedExercisesList.map((exercise) => {
                  // Get the rating for this exercise - check the exercise object first (from optimistic update)
                  let currentRating = undefined;
                  
                  if (exercise.existingRating) {
                    // Map backend rating to frontend display
                    currentRating = exercise.existingRating === "maybe_later" ? "not_sure" : exercise.existingRating;
                  } else if (exerciseRatings.has(exercise.exerciseId)) {
                    // Fallback to the ratings map
                    currentRating = exerciseRatings.get(exercise.exerciseId);
                  }
                  
                  return (
                    <ExerciseCard 
                      key={exercise.exerciseId}
                      exercise={exercise} 
                      currentRating={currentRating}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}