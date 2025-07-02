import type { Exercise } from "../types";

/**
 * Formats a list of exercises into a workout plan string
 * @param exercises - Array of exercises to format
 * @returns string - Formatted exercise list
 */
function formatExerciseList(exercises: Exercise[]): string {
  return exercises
    .map(ex => `- ${ex.name} (${ex.equipment?.join(', ') ?? 'bodyweight'}): 3 sets of 8-12`)
    .join('\n');
}

/**
 * Formats a complete workout plan with push/pull/legs structure
 * @param pushExercises - Exercises for push day
 * @param pullExercises - Exercises for pull day  
 * @param legExercises - Exercises for leg day
 * @returns string - Complete formatted workout plan
 */
export function formatWorkoutPlan(
  pushExercises: Exercise[], 
  pullExercises: Exercise[], 
  legExercises: Exercise[]
): string {
  return `Day 1: Push (Chest, Shoulders, Triceps)
${formatExerciseList(pushExercises)}

Day 2: Pull (Back, Biceps)
${formatExerciseList(pullExercises)}

Day 3: Legs
${formatExerciseList(legExercises)}`;
}