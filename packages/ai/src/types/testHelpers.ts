import type { FilterWorkoutTemplate } from "./filterTypes";

/**
 * Helper to create a minimal workout template for tests
 */
export function createTestWorkoutTemplate(
  isFullBody = false,
): FilterWorkoutTemplate {
  return {
    workout_goal: "mixed_focus",
    muscle_target: [],
    workout_intensity: "moderate_local",
    isFullBody,
  };
}
