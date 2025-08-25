/**
 * Client-safe exports from @acme/ai package
 * This file only exports types and constants that can be safely used in browser code
 */

// Types that are safe for client-side
export type { Exercise } from "./types/exercise";

export type { ClientContext } from "./types/clientContext";

export type { GroupContext, GroupScoredExercise } from "./types/groupContext";

export type { ScoredExercise } from "./types/scoredExercise";

export type {
  GroupWorkoutBlueprint,
  GroupBlockBlueprint,
} from "./types/groupBlueprint";

export type {
  StandardGroupWorkoutBlueprint,
  BucketedSelection,
  ClientExercisePool,
  PreAssignedExercise,
} from "./types/standardBlueprint";

// Client-safe constants
export {
  WorkoutType,
  BUCKET_CONFIGS,
  type BucketConstraints,
} from "./types/clientTypes";

// Muscle mapping utilities
export {
  CONSOLIDATED_MUSCLES,
  getOldMusclesForConsolidated,
  mapMuscleToConsolidated,
  type ConsolidatedMuscle,
} from "./constants/muscleMapping";

// Shared exercise utilities
export {
  categorizeSharedExercises,
  isCoreOrFinisherExercise,
  getExerciseCategory,
  type CategorizedSharedExercises,
} from "./workout-generation/standard/sharedExerciseFilters";
