/**
 * RoutineTemplate type for LangGraph workflow
 * Contains routine-specific programming parameters
 */
export interface RoutineTemplate {
  routine_goal: "hypertrophy" | "mixed_focus" | "conditioning" | "mobility" | "power" | "stability_control";
  muscle_target: string[]; // Array of muscles to target in this routine template
  routine_intensity: "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic" | "all";
}

// All available muscle options for full body routines
const ALL_MUSCLES = [
  "glutes", "quads", "hamstrings", "calves", "adductors", "abductors",
  "core", "lower_abs", "upper_abs", "obliques", "chest", "upper_chest", 
  "lower_chest", "lats", "traps", "biceps", "triceps", "shoulders", 
  "delts", "upper_back", "lower_back", "shins", "tibialis_anterior"
];

/**
 * Create a default routine template
 */
export function createDefaultRoutineTemplate(
  routineGoal: RoutineTemplate["routine_goal"] = "mixed_focus",
  muscleTarget: string[] = ALL_MUSCLES,
  routineIntensity: RoutineTemplate["routine_intensity"] = "moderate_local"
): RoutineTemplate {
  return {
    routine_goal: routineGoal,
    muscle_target: muscleTarget,
    routine_intensity: routineIntensity,
  };
}