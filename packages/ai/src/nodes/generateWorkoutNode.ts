import type { WorkoutStateType } from "../types";
import { fetchAllExercises, selectRandomExercisesByMuscles, formatWorkoutPlan } from "../utils";

/**
 * LangGraph node that generates a complete workout plan
 * Fetches exercises from database, selects random ones by muscle group, and formats the plan
 * @param state - Current workflow state
 * @returns Updated state with workout plan and selected exercises
 */
export async function generateWorkoutNode(state: WorkoutStateType) {
  // Fetch all exercises from database
  const allExercises = await fetchAllExercises();
  
  // Select random exercises for each muscle group
  const pushExercises = selectRandomExercisesByMuscles(allExercises, ['chest', 'shoulders', 'triceps'], 3);
  const pullExercises = selectRandomExercisesByMuscles(allExercises, ['lats', 'biceps', 'upper_back'], 3);
  const legExercises = selectRandomExercisesByMuscles(allExercises, ['quads', 'glutes', 'hamstrings'], 3);
  
  // Format the workout plan
  const workoutPlan = formatWorkoutPlan(pushExercises, pullExercises, legExercises);

  return {
    workoutPlan,
    exercises: [...pushExercises, ...pullExercises, ...legExercises],
  };
}