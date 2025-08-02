/**
 * Client-safe exports from @acme/ai package
 * This file only exports types and constants that can be safely used in browser code
 */

// Types that are safe for client-side
export type { 
  Exercise,
  ExerciseCategory,
  MuscleGroup,
  Equipment,
  JointLoadingType,
  FunctionalTag,
  MovementPattern
} from "./types/exercise";

export type {
  ClientContext
} from "./types/clientContext";

export type {
  GroupContext,
  GroupScoredExercise
} from "./types/groupContext";

export type {
  GroupWorkoutBlueprint,
  GroupBlockBlueprint,
  SharedCandidates,
  IndividualCandidates,
  GroupWorkoutSummary
} from "./types/groupBlueprint";

export type {
  StandardGroupWorkoutBlueprint,
  StandardClientExercisePool,
  StandardSharedExercise
} from "./types/standardBlueprint";

// Client-safe constants
export {
  WorkoutType,
  BUCKET_CONFIGS,
  type BucketConstraints
} from "./types/clientTypes";