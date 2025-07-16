'use client';

import { useCallback, useRef } from 'react';

// Platform-agnostic types
export interface WorkoutExercise {
  id: string;
  orderIndex: number;
  setsCompleted: number;
  groupName: string;
  createdAt: Date;
  exercise: {
    id: string;
    name: string;
    primaryMuscle: string;
    secondaryMuscles?: string[];
    movementPattern: string;
    modality: string;
    equipment?: string[];
  };
}

export interface WorkoutDetail {
  id: string;
  exercises: WorkoutExercise[];
  [key: string]: any;
}

interface OptimisticAPI {
  useUtils: () => {
    workout: {
      getById: {
        setData: (input: { id: string }, updater: (old?: WorkoutDetail) => WorkoutDetail | undefined) => void;
      };
    };
  };
  workout: {
    getById: {
      useQuery: (input: { id: string }, options?: any) => { data?: WorkoutDetail };
    };
  };
}

export function useOptimisticWorkout(workoutId: string, api: OptimisticAPI) {
  const utils = api.useUtils();
  const previousDataRef = useRef<WorkoutDetail | null>(null);

  // Get current workout data
  const { data: workout } = api.workout.getById.useQuery(
    { id: workoutId },
    { enabled: !!workoutId }
  );

  // Optimistic delete exercise
  const optimisticDeleteExercise = useCallback(
    (workoutExerciseId: string) => {
      if (!workout) return;

      // Store previous data
      previousDataRef.current = workout;

      // Find the exercise to delete
      const exerciseToDelete = workout.exercises.find(
        (ex) => ex.id === workoutExerciseId
      );
      if (!exerciseToDelete) return;

      // Filter out the exercise and reorder remaining ones in the same group
      const remainingExercises = workout.exercises
        .filter((ex) => ex.id !== workoutExerciseId)
        .map((ex) => {
          // Only reorder exercises in the same group that come after the deleted one
          if (
            ex.groupName === exerciseToDelete.groupName &&
            ex.orderIndex > exerciseToDelete.orderIndex
          ) {
            return { ...ex, orderIndex: ex.orderIndex - 1 };
          }
          return ex;
        })
        .sort((a, b) => a.orderIndex - b.orderIndex);

      // Update cache optimistically
      utils.workout.getById.setData({ id: workoutId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: remainingExercises,
        };
      });
    },
    [workout, workoutId, utils]
  );

  // Optimistic reorder exercise
  const optimisticReorderExercise = useCallback(
    (workoutExerciseId: string, direction: 'up' | 'down') => {
      if (!workout) return;

      // Store previous data
      previousDataRef.current = workout;

      const exercises = [...workout.exercises];
      const currentIndex = exercises.findIndex((ex) => ex.id === workoutExerciseId);
      if (currentIndex === -1) return;

      const currentExercise = exercises[currentIndex];
      
      // Find exercises in the same group
      const groupExercises = exercises
        .filter((ex) => ex.groupName === currentExercise.groupName)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const currentGroupIndex = groupExercises.findIndex(
        (ex) => ex.id === workoutExerciseId
      );
      const targetGroupIndex =
        direction === 'up' ? currentGroupIndex - 1 : currentGroupIndex + 1;

      // Check boundaries
      if (targetGroupIndex < 0 || targetGroupIndex >= groupExercises.length) {
        return;
      }

      const targetExercise = groupExercises[targetGroupIndex];

      // Swap orderIndex values
      const updatedExercises = exercises.map((ex) => {
        if (ex.id === currentExercise.id) {
          return { ...ex, orderIndex: targetExercise.orderIndex };
        }
        if (ex.id === targetExercise.id) {
          return { ...ex, orderIndex: currentExercise.orderIndex };
        }
        return ex;
      });

      // Update cache optimistically
      utils.workout.getById.setData({ id: workoutId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: updatedExercises.sort((a, b) => a.orderIndex - b.orderIndex),
        };
      });
    },
    [workout, workoutId, utils]
  );

  // Optimistic delete block
  const optimisticDeleteBlock = useCallback(
    (groupName: string) => {
      if (!workout) return;

      // Store previous data
      previousDataRef.current = workout;

      // Filter out all exercises in the block
      const remainingExercises = workout.exercises.filter(
        (ex) => ex.groupName !== groupName
      );

      // Update cache optimistically
      utils.workout.getById.setData({ id: workoutId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: remainingExercises,
        };
      });
    },
    [workout, workoutId, utils]
  );

  // Optimistic replace exercise
  const optimisticReplaceExercise = useCallback(
    (workoutExerciseId: string, newExercise: Partial<WorkoutExercise['exercise']>) => {
      if (!workout) return;

      // Store previous data
      previousDataRef.current = workout;

      // Update the exercise
      const updatedExercises = workout.exercises.map((ex) => {
        if (ex.id === workoutExerciseId) {
          return {
            ...ex,
            exercise: {
              ...ex.exercise,
              ...newExercise,
            },
          };
        }
        return ex;
      });

      // Update cache optimistically
      utils.workout.getById.setData({ id: workoutId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: updatedExercises,
        };
      });
    },
    [workout, workoutId, utils]
  );

  // Optimistic add exercise
  const optimisticAddExercise = useCallback(
    (
      exercise: Partial<WorkoutExercise['exercise']>,
      groupName: string,
      position: 'beginning' | 'end' = 'end',
      sets: number = 3
    ) => {
      if (!workout) return;

      // Store previous data
      previousDataRef.current = workout;

      const exercises = [...workout.exercises];
      const groupExercises = exercises.filter((ex) => ex.groupName === groupName);

      let newOrderIndex: number;
      let updatedExercises: typeof exercises;

      if (position === 'beginning' && groupExercises.length > 0) {
        newOrderIndex = groupExercises[0].orderIndex;
        // Increment all exercises at or after this position
        updatedExercises = exercises.map((ex) => {
          if (ex.orderIndex >= newOrderIndex) {
            return { ...ex, orderIndex: ex.orderIndex + 1 };
          }
          return ex;
        });
      } else {
        // Add at end
        if (groupExercises.length > 0) {
          newOrderIndex = groupExercises[groupExercises.length - 1].orderIndex + 1;
        } else if (exercises.length > 0) {
          newOrderIndex = exercises[exercises.length - 1].orderIndex + 1;
        } else {
          newOrderIndex = 1;
        }
        updatedExercises = exercises;
      }

      // Create new exercise
      const newExercise: WorkoutExercise = {
        id: `temp-${Date.now()}`, // Temporary ID
        orderIndex: newOrderIndex,
        setsCompleted: sets,
        groupName,
        createdAt: new Date(),
        exercise: {
          id: exercise.id || '',
          name: exercise.name || 'New Exercise',
          primaryMuscle: exercise.primaryMuscle || 'chest',
          secondaryMuscles: exercise.secondaryMuscles || [],
          movementPattern: exercise.movementPattern || 'horizontal_push',
          modality: exercise.modality || 'strength',
          equipment: exercise.equipment || [],
        },
      };

      // Update cache optimistically
      utils.workout.getById.setData({ id: workoutId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: [...updatedExercises, newExercise].sort(
            (a, b) => a.orderIndex - b.orderIndex
          ),
        };
      });
    },
    [workout, workoutId, utils]
  );

  // Rollback function
  const rollback = useCallback(() => {
    if (previousDataRef.current) {
      utils.workout.getById.setData({ id: workoutId }, previousDataRef.current);
      previousDataRef.current = null;
    }
  }, [workoutId, utils]);

  return {
    workout,
    optimisticDeleteExercise,
    optimisticReorderExercise,
    optimisticDeleteBlock,
    optimisticReplaceExercise,
    optimisticAddExercise,
    rollback,
  };
}