'use client';

import { useCallback } from 'react';
import type { WorkoutMutationOptions } from './types';

// Platform-agnostic API interface
interface WorkoutAPI {
  useUtils: () => any;
  workout: {
    deleteExercise: {
      useMutation: (options?: any) => any;
    };
    updateExerciseOrder: {
      useMutation: (options?: any) => any;
    };
    deleteBlock: {
      useMutation: (options?: any) => any;
    };
    deleteWorkout: {
      useMutation: (options?: any) => any;
    };
    replaceExercise: {
      useMutation: (options?: any) => any;
    };
    addExercise: {
      useMutation: (options?: any) => any;
    };
    duplicateWorkout: {
      useMutation: (options?: any) => any;
    };
  };
}

export function useWorkoutMutations(api: WorkoutAPI) {
  const utils = api.useUtils();

  // Delete exercise mutation
  const deleteExerciseMutation = api.workout.deleteExercise.useMutation({
    onSuccess: () => {
      void utils.workout.getById.invalidate();
    },
  });

  // Update exercise order mutation
  const updateExerciseOrderMutation = api.workout.updateExerciseOrder.useMutation({
    onSuccess: () => {
      void utils.workout.getById.invalidate();
    },
  });

  // Delete block mutation
  const deleteBlockMutation = api.workout.deleteBlock.useMutation({
    onSuccess: () => {
      void utils.workout.getById.invalidate();
    },
  });

  // Delete workout mutation
  const deleteWorkoutMutation = api.workout.deleteWorkout.useMutation({
    onSuccess: () => {
      void utils.workout.myWorkouts.invalidate();
      void utils.workout.clientWorkouts.invalidate();
    },
  });

  // Replace exercise mutation
  const replaceExerciseMutation = api.workout.replaceExercise.useMutation({
    onSuccess: () => {
      void utils.workout.getById.invalidate();
    },
  });

  // Add exercise mutation
  const addExerciseMutation = api.workout.addExercise.useMutation({
    onSuccess: () => {
      void utils.workout.getById.invalidate();
    },
  });

  // Duplicate workout mutation
  const duplicateWorkoutMutation = api.workout.duplicateWorkout.useMutation({
    onSuccess: () => {
      void utils.workout.myWorkouts.invalidate();
      void utils.workout.clientWorkouts.invalidate();
    },
  });

  // Wrapper functions with options
  const deleteExercise = useCallback(
    async (
      workoutId: string,
      workoutExerciseId: string,
      options?: WorkoutMutationOptions
    ) => {
      try {
        const result = await deleteExerciseMutation.mutateAsync({
          workoutId,
          workoutExerciseId,
        });
        options?.onSuccess?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [deleteExerciseMutation]
  );

  const updateExerciseOrder = useCallback(
    async (
      workoutId: string,
      workoutExerciseId: string,
      direction: 'up' | 'down',
      options?: WorkoutMutationOptions
    ) => {
      try {
        const result = await updateExerciseOrderMutation.mutateAsync({
          workoutId,
          workoutExerciseId,
          direction,
        });
        options?.onSuccess?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [updateExerciseOrderMutation]
  );

  const deleteBlock = useCallback(
    async (
      workoutId: string,
      groupName: string,
      options?: WorkoutMutationOptions
    ) => {
      try {
        const result = await deleteBlockMutation.mutateAsync({
          workoutId,
          groupName,
        });
        options?.onSuccess?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [deleteBlockMutation]
  );

  const deleteWorkout = useCallback(
    async (workoutId: string, options?: WorkoutMutationOptions) => {
      try {
        const result = await deleteWorkoutMutation.mutateAsync({
          workoutId,
        });
        options?.onSuccess?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [deleteWorkoutMutation]
  );

  const replaceExercise = useCallback(
    async (
      workoutId: string,
      workoutExerciseId: string,
      newExerciseId: string,
      options?: WorkoutMutationOptions
    ) => {
      try {
        const result = await replaceExerciseMutation.mutateAsync({
          workoutId,
          workoutExerciseId,
          newExerciseId,
        });
        options?.onSuccess?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [replaceExerciseMutation]
  );

  const addExercise = useCallback(
    async (
      workoutId: string,
      exerciseId: string,
      groupName: string,
      position: 'beginning' | 'end' = 'end',
      sets: number = 3,
      options?: WorkoutMutationOptions
    ) => {
      try {
        const result = await addExerciseMutation.mutateAsync({
          workoutId,
          exerciseId,
          groupName,
          position,
          sets,
        });
        options?.onSuccess?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [addExerciseMutation]
  );

  const duplicateWorkout = useCallback(
    async (
      workoutId: string,
      targetUserId?: string,
      notes?: string,
      options?: WorkoutMutationOptions
    ) => {
      try {
        const result = await duplicateWorkoutMutation.mutateAsync({
          workoutId,
          targetUserId,
          notes,
        });
        options?.onSuccess?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [duplicateWorkoutMutation]
  );

  return {
    // Raw mutations (for advanced use cases)
    mutations: {
      deleteExercise: deleteExerciseMutation,
      updateExerciseOrder: updateExerciseOrderMutation,
      deleteBlock: deleteBlockMutation,
      deleteWorkout: deleteWorkoutMutation,
      replaceExercise: replaceExerciseMutation,
      addExercise: addExerciseMutation,
      duplicateWorkout: duplicateWorkoutMutation,
    },
    // Wrapped functions with options
    deleteExercise,
    updateExerciseOrder,
    deleteBlock,
    deleteWorkout,
    replaceExercise,
    addExercise,
    duplicateWorkout,
    // Loading states
    isLoading:
      deleteExerciseMutation.isPending ||
      updateExerciseOrderMutation.isPending ||
      deleteBlockMutation.isPending ||
      deleteWorkoutMutation.isPending ||
      replaceExerciseMutation.isPending ||
      addExerciseMutation.isPending ||
      duplicateWorkoutMutation.isPending,
  };
}