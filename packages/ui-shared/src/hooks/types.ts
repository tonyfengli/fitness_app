export interface WorkoutMutationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  showToast?: boolean;
}

export interface ExerciseReorderDirection {
  direction: 'up' | 'down';
}

export interface ExerciseAddPosition {
  position: 'beginning' | 'end';
}

export interface WorkoutActionContext {
  workoutId: string;
  exerciseId?: string;
  workoutExerciseId?: string;
  groupName?: string;
}

export interface OptimisticUpdate<T> {
  previousData: T;
  newData: T;
  rollback: () => void;
}

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface MutationState {
  status: MutationStatus;
  error: Error | null;
}