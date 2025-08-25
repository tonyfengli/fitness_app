/**
 * Standard workout generation exports
 */

export { StandardWorkoutGenerator } from "./StandardWorkoutGenerator";
export type {
  ExerciseSelection,
  StandardWorkoutPlan,
} from "./types";

// Shared exercise utilities
export { SharedExerciseSelector } from "./SharedExerciseSelector";
export type { SharedExerciseSelectionResult } from "./SharedExerciseSelector";
export {
  categorizeSharedExercises,
  isCoreOrFinisherExercise,
  getExerciseCategory,
} from "./sharedExerciseFilters";
export type { CategorizedSharedExercises } from "./sharedExerciseFilters";
