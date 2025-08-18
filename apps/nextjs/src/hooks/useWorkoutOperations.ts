import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export function useWorkoutOperations(clientId: string) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const invalidateWorkouts = async () => {
    await queryClient.invalidateQueries({
      queryKey: [
        ["workout", "getClientWorkoutsWithExercises"],
        { input: { clientId } },
      ],
    });
  };

  // Delete workout mutation
  const deleteWorkout = useMutation({
    ...trpc.workout.deleteWorkout.mutationOptions(),
    onSuccess: invalidateWorkouts,
  });

  // Delete block mutation
  const deleteBlock = useMutation({
    ...trpc.workout.deleteBlock.mutationOptions(),
    onSuccess: invalidateWorkouts,
  });

  // Delete exercise mutation
  const deleteExercise = useMutation({
    ...trpc.workout.deleteExercise.mutationOptions(),
    onSuccess: invalidateWorkouts,
  });

  // Add exercise mutation
  const addExercise = useMutation({
    ...trpc.workout.addExercise.mutationOptions(),
    onSuccess: invalidateWorkouts,
  });

  // Duplicate workout mutation
  const duplicateWorkout = useMutation({
    ...trpc.workout.duplicateWorkout.mutationOptions(),
    onSuccess: invalidateWorkouts,
  });

  // Move exercise mutation
  const moveExercise = useMutation({
    ...trpc.workout.updateExerciseOrder.mutationOptions(),
    onSuccess: invalidateWorkouts,
  });

  // Replace exercise mutation
  const replaceExercise = useMutation({
    ...trpc.workout.replaceExercise.mutationOptions(),
    onSuccess: invalidateWorkouts,
  });

  // Update exercise sets mutation
  const updateExerciseSets = useMutation({
    ...trpc.workout.updateExerciseSets.mutationOptions(),
    onSuccess: invalidateWorkouts,
  });

  return {
    // Mutations
    deleteWorkout,
    deleteBlock,
    deleteExercise,
    addExercise,
    duplicateWorkout,
    moveExercise,
    replaceExercise,
    updateExerciseSets,
    // Utility
    invalidateWorkouts,
  };
}
