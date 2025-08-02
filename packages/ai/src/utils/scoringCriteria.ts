import type { ClientContext } from "../types";
import type { ScoringCriteria } from "../types/scoredExercise";

/**
 * Build scoring criteria from client context
 * Extracted from filterExercisesFromInput for better separation of concerns
 */
export function buildScoringCriteria(
  clientContext: ClientContext | undefined,
  intensityOverride?: "low" | "moderate" | "high"
): ScoringCriteria | undefined {
  if (!clientContext) {
    return undefined;
  }

  return {
    includeExercises: clientContext.exercise_requests?.include ?? [],
    muscleTarget: clientContext.muscle_target ?? [],
    muscleLessen: clientContext.muscle_lessen ?? [],
    intensity: intensityOverride ?? clientContext.intensity, // Use override if provided, otherwise use client's intensity
    skillLevel: clientContext.skill_capacity,
    strengthLevel: clientContext.strength_capacity,
    favoriteExerciseIds: clientContext.favoriteExerciseIds,
  };
}