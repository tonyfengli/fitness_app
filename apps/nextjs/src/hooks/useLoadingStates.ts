import { useState } from "react";

type LoadingStateTypes =
  | "deletingWorkoutId"
  | "deletingExerciseId"
  | "deletingBlockName"
  | "movingExerciseId";

export function useLoadingStates() {
  const [loadingStates, setLoadingStates] = useState({
    deletingWorkoutId: null as string | null,
    deletingExerciseId: null as string | null,
    deletingBlockName: null as string | null,
    movingExerciseId: null as string | null,
  });

  const setLoading = (type: LoadingStateTypes, id: string | null) => {
    setLoadingStates((prev) => ({ ...prev, [type]: id }));
  };

  const clearLoading = (type: LoadingStateTypes) => {
    setLoadingStates((prev) => ({ ...prev, [type]: null }));
  };

  const clearAllLoading = () => {
    setLoadingStates({
      deletingWorkoutId: null,
      deletingExerciseId: null,
      deletingBlockName: null,
      movingExerciseId: null,
    });
  };

  const isLoading = (type: LoadingStateTypes, id?: string) => {
    if (id) {
      return loadingStates[type] === id;
    }
    return loadingStates[type] !== null;
  };

  return {
    ...loadingStates,
    setLoading,
    clearLoading,
    clearAllLoading,
    isLoading,
  };
}
