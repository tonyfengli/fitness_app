/**
 * WorkoutTemplate type for LangGraph workflow
 * Contains workout-specific programming parameters
 */
export interface WorkoutTemplate {
  workout_goal:
    | "hypertrophy"
    | "mixed_focus"
    | "conditioning"
    | "mobility"
    | "power"
    | "stability_control";
  muscle_target: string[]; // Array of muscles to target in this workout template
  workout_intensity:
    | "low_local"
    | "moderate_local"
    | "high_local"
    | "moderate_systemic"
    | "high_systemic"
    | "metabolic"
    | "all";
}

// All available muscle options for full body workouts
const ALL_MUSCLES = [
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "adductors",
  "abductors",
  "core",
  "lower_abs",
  "upper_abs",
  "obliques",
  "chest",
  "upper_chest",
  "lower_chest",
  "lats",
  "traps",
  "biceps",
  "triceps",
  "shoulders",
  "delts",
  "upper_back",
  "lower_back",
  "shins",
  "tibialis_anterior",
];

/**
 * Create a default workout template
 */
export function createDefaultWorkoutTemplate(
  workoutGoal: WorkoutTemplate["workout_goal"] = "mixed_focus",
  muscleTarget: string[] = ALL_MUSCLES,
  workoutIntensity: WorkoutTemplate["workout_intensity"] = "moderate_local",
): WorkoutTemplate {
  return {
    workout_goal: workoutGoal,
    muscle_target: muscleTarget,
    workout_intensity: workoutIntensity,
  };
}
