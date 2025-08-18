/**
 * Type guard for BMF blueprint (original block-based)
 */
import type { GroupWorkoutBlueprint } from "./groupBlueprint";
import type { GroupScoredExercise } from "./groupContext";
import type { ScoredExercise } from "./scoredExercise";

/**
 * Pre-assigned exercise with source tracking
 */
export interface PreAssignedExercise {
  exercise: ScoredExercise;
  source:
    | "Round1"
    | "Round2"
    | "Include"
    | "favorite"
    | "shared_other"
    | "shared_core_finisher"
    | string; // Which round it came from
  tiedCount?: number; // Number of exercises tied at the same score (for favorites)
  sharedWith?: string[]; // Client IDs if this is a shared exercise selection
}

/**
 * Bucketed selection info
 */
export interface BucketedSelection {
  exercises: ScoredExercise[];
  bucketAssignments: {
    [exerciseId: string]: {
      bucketType: "movement_pattern" | "functional" | "flex";
      constraint: string;
    };
  };
}

/**
 * Client exercise pool for standard template
 */
export interface ClientExercisePool {
  preAssigned: PreAssignedExercise[];
  availableCandidates: ScoredExercise[]; // ALL exercises for this client
  bucketedSelection?: BucketedSelection; // Selected exercises via bucketing
  totalExercisesNeeded: number; // e.g., 8
  additionalNeeded: number; // e.g., 6 (8 total - 2 preassigned)
}

/**
 * Blueprint for standard template group workout
 * Uses client-pooled exercises instead of block-based
 */
export interface StandardGroupWorkoutBlueprint {
  clientExercisePools: {
    [clientId: string]: ClientExercisePool;
  };

  sharedExercisePool: GroupScoredExercise[]; // ALL shared exercises across workout

  metadata: {
    templateType: string;
    workoutFlow: "strength-metabolic" | "pure-strength";
    totalExercisesPerClient: number;
    preAssignedCount: number;
  };

  validationWarnings?: string[];
}

/**
 * Type guard for standard blueprint
 */
export function isStandardBlueprint(
  blueprint: any,
): blueprint is StandardGroupWorkoutBlueprint {
  return (
    "clientExercisePools" in blueprint && "sharedExercisePool" in blueprint
  );
}

export function isBMFBlueprint(
  blueprint: any,
): blueprint is GroupWorkoutBlueprint {
  return "blocks" in blueprint && !("clientExercisePools" in blueprint);
}
