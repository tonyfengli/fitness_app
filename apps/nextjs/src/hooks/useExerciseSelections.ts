import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export function useExerciseSelections(sessionId: string | null) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  // Get current selections
  const { data: selections, isLoading } = useQuery(
    sessionId
      ? trpc.workoutSelections.getSelections.queryOptions({ sessionId })
      : {
          enabled: false,
          queryKey: ["disabled"],
          queryFn: () => Promise.resolve([]),
        },
  );

  // Get swap history
  const { data: swapHistory } = useQuery(
    sessionId
      ? trpc.workoutSelections.getSwapHistory.queryOptions({ sessionId })
      : {
          enabled: false,
          queryKey: ["disabled"],
          queryFn: () => Promise.resolve([]),
        },
  );

  // Swap exercise mutation
  const swapExercise = useMutation(
    trpc.workoutSelections.swapExercise.mutationOptions({
      onSuccess: () => {
        // Invalidate both selections and swap history
        queryClient.invalidateQueries({
          queryKey: [["workoutSelections", "getSelections"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["workoutSelections", "getSwapHistory"]],
        });
      },
    }),
  );

  // Get alternatives for swapping
  const getSwapAlternatives = async (
    clientId: string,
    currentExerciseId: string,
  ) => {
    if (!sessionId) return [];

    return trpc.workoutSelections.getSwapAlternatives.query({
      sessionId,
      clientId,
      currentExerciseId,
    });
  };

  // Finalize selections mutation
  const finalizeSelections = useMutation(
    trpc.workoutSelections.finalizeSelections.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    }),
  );

  return {
    selections,
    swapHistory,
    isLoading,
    swapExercise: swapExercise.mutate,
    getSwapAlternatives,
    finalizeSelections: finalizeSelections.mutate,
    isSwapping: swapExercise.isPending,
    isFinalizing: finalizeSelections.isPending,
  };
}
