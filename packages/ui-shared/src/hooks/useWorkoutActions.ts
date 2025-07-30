'use client';

import { useCallback, useState } from 'react';
import { useWorkoutMutations } from './useWorkoutMutations';
import { useOptimisticWorkout } from './useOptimisticWorkout';
import type { WorkoutMutationOptions, MutationState } from './types';

// Platform-agnostic toast interface
interface ToastConfig {
  showToast: (message: string, type: 'success' | 'error') => void;
}

interface UseWorkoutActionsOptions {
  workoutId: string;
  api: any; // Platform-specific API object
  toast?: ToastConfig;
  onDeleteWorkoutSuccess?: () => void;
  onDuplicateSuccess?: (newWorkoutId: string) => void;
}

export function useWorkoutActions({
  workoutId,
  api,
  toast,
  onDeleteWorkoutSuccess,
  onDuplicateSuccess,
}: UseWorkoutActionsOptions) {
  const mutations = useWorkoutMutations(api);
  const optimistic = useOptimisticWorkout(workoutId, api);
  
  const [actionState, setActionState] = useState<Record<string, MutationState>>({});

  const setMutationState = useCallback((key: string, state: Partial<MutationState>) => {
    setActionState((prev) => ({
      ...prev,
      [key]: {
        status: state.status ?? prev[key]?.status ?? 'idle',
        error: state.error ?? prev[key]?.error ?? null,
      },
    }));
  }, []);

  // Delete exercise with optimistic update
  const handleDeleteExercise = useCallback(
    async (workoutExerciseId: string, exerciseName?: string) => {
      const key = `delete-exercise-${workoutExerciseId}`;
      setMutationState(key, { status: 'pending', error: null });

      // Optimistic update
      optimistic.optimisticDeleteExercise(workoutExerciseId);

      try {
        await mutations.deleteExercise(workoutId, workoutExerciseId, {
          onSuccess: () => {
            setMutationState(key, { status: 'success', error: null });
            toast?.showToast(
              `Deleted ${exerciseName || 'exercise'} from workout`,
              'success'
            );
          },
          onError: (error) => {
            setMutationState(key, { status: 'error', error });
            optimistic.rollback();
            toast?.showToast(
              `Failed to delete exercise: ${error.message}`,
              'error'
            );
          },
        });
      } catch (error) {
        // Error already handled in onError
      }
    },
    [workoutId, mutations, optimistic, toast]
  );

  // Reorder exercise with optimistic update
  const handleReorderExercise = useCallback(
    async (
      workoutExerciseId: string,
      direction: 'up' | 'down',
      exerciseName?: string
    ) => {
      const key = `reorder-exercise-${workoutExerciseId}`;
      setMutationState(key, { status: 'pending', error: null });

      // Optimistic update
      optimistic.optimisticReorderExercise(workoutExerciseId, direction);

      try {
        await mutations.updateExerciseOrder(workoutId, workoutExerciseId, direction, {
          onSuccess: () => {
            setMutationState(key, { status: 'success', error: null });
            toast?.showToast(
              `Moved ${exerciseName || 'exercise'} ${direction}`,
              'success'
            );
          },
          onError: (error) => {
            setMutationState(key, { status: 'error', error });
            optimistic.rollback();
            toast?.showToast(
              `Failed to reorder exercise: ${error.message}`,
              'error'
            );
          },
        });
      } catch (error) {
        // Error already handled in onError
      }
    },
    [workoutId, mutations, optimistic, toast]
  );

  // Delete block with optimistic update
  const handleDeleteBlock = useCallback(
    async (groupName: string) => {
      const key = `delete-block-${groupName}`;
      setMutationState(key, { status: 'pending', error: null });

      // Optimistic update
      optimistic.optimisticDeleteBlock(groupName);

      try {
        await mutations.deleteBlock(workoutId, groupName, {
          onSuccess: () => {
            setMutationState(key, { status: 'success', error: null });
            toast?.showToast(`Deleted ${groupName}`, 'success');
          },
          onError: (error) => {
            setMutationState(key, { status: 'error', error });
            optimistic.rollback();
            toast?.showToast(
              `Failed to delete block: ${error.message}`,
              'error'
            );
          },
        });
      } catch (error) {
        // Error already handled in onError
      }
    },
    [workoutId, mutations, optimistic, toast]
  );

  // Delete workout (no optimistic update needed)
  const handleDeleteWorkout = useCallback(async () => {
    const key = 'delete-workout';
    setMutationState(key, { status: 'pending', error: null });

    try {
      await mutations.deleteWorkout(workoutId, {
        onSuccess: () => {
          setMutationState(key, { status: 'success', error: null });
          toast?.showToast('Workout deleted successfully', 'success');
          onDeleteWorkoutSuccess?.();
        },
        onError: (error) => {
          setMutationState(key, { status: 'error', error });
          toast?.showToast(
            `Failed to delete workout: ${error.message}`,
            'error'
          );
        },
      });
    } catch (error) {
      // Error already handled in onError
    }
  }, [workoutId, mutations, toast, onDeleteWorkoutSuccess]);

  // Replace exercise with optimistic update
  const handleReplaceExercise = useCallback(
    async (
      workoutExerciseId: string,
      newExerciseId: string,
      newExerciseData?: {
        name: string;
        primaryMuscle: string;
        equipment: string[];
      }
    ) => {
      const key = `replace-exercise-${workoutExerciseId}`;
      setMutationState(key, { status: 'pending', error: null });

      // Optimistic update if we have the new exercise data
      if (newExerciseData) {
        optimistic.optimisticReplaceExercise(workoutExerciseId, newExerciseData);
      }

      try {
        await mutations.replaceExercise(
          workoutId,
          workoutExerciseId,
          newExerciseId,
          {
            onSuccess: () => {
              setMutationState(key, { status: 'success', error: null });
              toast?.showToast(
                `Replaced with ${newExerciseData?.name || 'new exercise'}`,
                'success'
              );
            },
            onError: (error) => {
              setMutationState(key, { status: 'error', error });
              if (newExerciseData) {
                optimistic.rollback();
              }
              toast?.showToast(
                `Failed to replace exercise: ${error.message}`,
                'error'
              );
            },
          }
        );
      } catch (error) {
        // Error already handled in onError
      }
    },
    [workoutId, mutations, optimistic, toast]
  );

  // Add exercise with optimistic update
  const handleAddExercise = useCallback(
    async (
      exerciseId: string,
      groupName: string,
      position: 'beginning' | 'end' = 'end',
      sets: number = 3,
      exerciseData?: {
        name: string;
        primaryMuscle: string;
        equipment: string[];
      }
    ) => {
      const key = `add-exercise-${exerciseId}`;
      setMutationState(key, { status: 'pending', error: null });

      // Optimistic update if we have the exercise data
      if (exerciseData) {
        optimistic.optimisticAddExercise(
          { id: exerciseId, ...exerciseData },
          groupName,
          position,
          sets
        );
      }

      try {
        await mutations.addExercise(
          workoutId,
          exerciseId,
          groupName,
          position,
          sets,
          {
            onSuccess: () => {
              setMutationState(key, { status: 'success', error: null });
              toast?.showToast(
                `Added ${exerciseData?.name || 'exercise'} to ${groupName}`,
                'success'
              );
            },
            onError: (error) => {
              setMutationState(key, { status: 'error', error });
              if (exerciseData) {
                optimistic.rollback();
              }
              toast?.showToast(
                `Failed to add exercise: ${error.message}`,
                'error'
              );
            },
          }
        );
      } catch (error) {
        // Error already handled in onError
      }
    },
    [workoutId, mutations, optimistic, toast]
  );

  // Duplicate workout (no optimistic update needed)
  const handleDuplicateWorkout = useCallback(
    async (targetUserId?: string, notes?: string) => {
      const key = 'duplicate-workout';
      setMutationState(key, { status: 'pending', error: null });

      try {
        const result = await mutations.duplicateWorkout(
          workoutId,
          targetUserId,
          notes,
          {
            onSuccess: () => {
              setMutationState(key, { status: 'success', error: null });
              toast?.showToast('Workout duplicated successfully', 'success');
            },
            onError: (error) => {
              setMutationState(key, { status: 'error', error });
              toast?.showToast(
                `Failed to duplicate workout: ${error.message}`,
                'error'
              );
            },
          }
        );
        
        if (result && typeof result === 'object' && 'workoutId' in result) {
          onDuplicateSuccess?.(result.workoutId as string);
        }
        
        return result;
      } catch (error) {
        // Error already handled in onError
        return null;
      }
    },
    [workoutId, mutations, toast, onDuplicateSuccess]
  );

  // Check if any action is in progress
  const isAnyActionPending = Object.values(actionState).some(
    (state) => state.status === 'pending'
  );

  // Get action state for specific operations
  const getActionState = useCallback(
    (actionType: string, id?: string) => {
      const key = id ? `${actionType}-${id}` : actionType;
      return actionState[key] || { status: 'idle' as const, error: null };
    },
    [actionState]
  );

  return {
    // Actions
    deleteExercise: handleDeleteExercise,
    reorderExercise: handleReorderExercise,
    deleteBlock: handleDeleteBlock,
    deleteWorkout: handleDeleteWorkout,
    replaceExercise: handleReplaceExercise,
    addExercise: handleAddExercise,
    duplicateWorkout: handleDuplicateWorkout,
    
    // State
    isLoading: mutations.isLoading || isAnyActionPending,
    workout: optimistic.workout,
    getActionState,
    
    // Direct access to mutations for advanced use
    mutations,
  };
}