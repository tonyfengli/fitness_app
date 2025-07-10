import type { ClientContext } from "../types";
import type { ScoringCriteria } from "../types/scoredExercise";

/**
 * Build scoring criteria from client context and intensity
 * Extracted from filterExercisesFromInput for better separation of concerns
 */
export function buildScoringCriteria(
  clientContext: ClientContext | undefined,
  intensity?: "low" | "moderate" | "high"
): ScoringCriteria | undefined {
  if (!clientContext) {
    return undefined;
  }

  return {
    includeExercises: clientContext.exercise_requests?.include ?? [],
    muscleTarget: clientContext.muscle_target ?? [],
    muscleLessen: clientContext.muscle_lessen ?? [],
    intensity: intensity,
    skillLevel: clientContext.skill_capacity,
    strengthLevel: clientContext.strength_capacity,
  };
}