import type { Exercise } from "../types";

/**
 * Randomly selects exercises by primary muscle groups
 * @param exercises - Array of all available exercises
 * @param primaryMuscles - Array of muscle groups to filter by
 * @param count - Number of exercises to select (default: 3)
 * @returns Exercise[] - Randomly selected exercises
 */
export function selectRandomExercisesByMuscles(
  exercises: Exercise[], 
  primaryMuscles: string[], 
  count: number = 3
): Exercise[] {
  const filtered = exercises.filter(ex => primaryMuscles.includes(ex.primaryMuscle));
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}