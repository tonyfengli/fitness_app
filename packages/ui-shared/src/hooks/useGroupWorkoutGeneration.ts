"use client";

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface UseGroupWorkoutGenerationOptions {
  sessionId: string;
  trpc: any; // tRPC client instance
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

/**
 * Shared hook for generating group workouts
 * Used by both visualization page (for debugging) and preferences page (for production)
 */
export const useGroupWorkoutGeneration = ({ 
  sessionId, 
  trpc,
  onSuccess,
  onError 
}: UseGroupWorkoutGenerationOptions) => {
  const { refetch, data, isLoading, error } = useQuery({
    ...trpc.trainingSession.generateGroupWorkout.queryOptions({ sessionId }),
    enabled: false, // Manual trigger only
  });

  const generate = useCallback(async () => {
    try {
      const result = await refetch();
      if (result.data && onSuccess) {
        onSuccess(result.data);
      }
      if (result.error && onError) {
        onError(result.error);
      }
      return result;
    } catch (err) {
      if (onError) {
        onError(err);
      }
      throw err;
    }
  }, [refetch, onSuccess, onError]);

  return {
    generate,
    isGenerating: isLoading,
    workoutData: data,
    error
  };
};