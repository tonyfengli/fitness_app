// Workout mutation hooks
export { useWorkoutMutations } from './useWorkoutMutations';
export { useOptimisticWorkout } from './useOptimisticWorkout';
export { useWorkoutActions } from './useWorkoutActions';

// Exercise selection hooks
export { useExerciseSelection } from './useExerciseSelection';

// Workout organization hooks
export { useWorkoutBlocks } from './useWorkoutBlocks';

// Client preferences hooks
export { useClientPreferences } from './useClientPreferences';
export { useRealtimePreferences } from './useRealtimePreferences';
export { useRealtimeStatus } from './useRealtimeStatus';
export { useRealtimeWorkoutExercises } from './useRealtimeWorkoutExercises';
export { useRealtimeExerciseSwaps } from './useRealtimeExerciseSwaps';
export { useRealtimeCircuitConfig } from './useRealtimeCircuitConfig';
export { useRealtimeCircuitExercises } from './useRealtimeCircuitExercises';

// UI state hooks
export { useModalState, useMultipleModals } from './useModalState';
export type { UseModalStateReturn } from './useModalState';

// Types
export type {
  WorkoutMutationOptions,
  ExerciseReorderDirection,
  ExerciseAddPosition,
  WorkoutActionContext,
  OptimisticUpdate,
  MutationStatus,
  MutationState,
} from './types';