/**
 * Utility functions to filter shared exercises into categories
 * for visualization and selection purposes
 */

import type { GroupScoredExercise } from "../../types/groupContext";

export interface CategorizedSharedExercises {
  coreAndFinisher: GroupScoredExercise[];
  other: GroupScoredExercise[];
}

/**
 * Categorizes shared exercises into two groups:
 * 1. Core & Finisher: Exercises with 'core' OR 'capacity' functional tags
 * 2. Other: All remaining shared exercises
 */
export function categorizeSharedExercises(
  sharedExercises: GroupScoredExercise[],
): CategorizedSharedExercises {
  const coreAndFinisher: GroupScoredExercise[] = [];
  const other: GroupScoredExercise[] = [];

  for (const exercise of sharedExercises) {
    // Check if exercise has core OR capacity tags
    const hasCoreOrCapacity =
      exercise.functionTags?.some(
        (tag) => tag === "core" || tag === "capacity",
      ) ?? false;

    if (hasCoreOrCapacity) {
      coreAndFinisher.push(exercise);
    } else {
      other.push(exercise);
    }
  }

  // Maintain the original sorting (by client count, then group score)
  return {
    coreAndFinisher,
    other,
  };
}

/**
 * Helper to check if an exercise is categorized as Core & Finisher
 */
export function isCoreOrFinisherExercise(
  exercise: GroupScoredExercise,
): boolean {
  return (
    exercise.functionTags?.some(
      (tag) => tag === "core" || tag === "capacity",
    ) ?? false
  );
}

/**
 * Get exercise category label for display
 */
export function getExerciseCategory(exercise: GroupScoredExercise): string {
  return isCoreOrFinisherExercise(exercise) ? "Core & Finisher" : "Other";
}
