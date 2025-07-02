import type { Exercise } from "../types";

export class ExerciseSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExerciseSelectionError';
  }
}

/**
 * Fisher-Yates shuffle algorithm for truly random distribution
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/**
 * Randomly selects exercises by primary muscle groups
 * @param exercises - Array of all available exercises
 * @param primaryMuscles - Array of muscle groups to filter by
 * @param count - Number of exercises to select (default: 3)
 * @returns Exercise[] - Randomly selected exercises
 * @throws {ExerciseSelectionError} If not enough exercises available
 */
export function selectRandomExercisesByMuscles(
  exercises: Exercise[], 
  primaryMuscles: string[], 
  count: number = 3
): Exercise[] {
  if (!exercises || exercises.length === 0) {
    throw new ExerciseSelectionError('No exercises provided');
  }
  
  if (!primaryMuscles || primaryMuscles.length === 0) {
    throw new ExerciseSelectionError('No muscle groups specified');
  }
  
  if (count < 1) {
    throw new ExerciseSelectionError('Count must be at least 1');
  }
  
  const filtered = exercises.filter(ex => 
    ex.primaryMuscle && primaryMuscles.includes(ex.primaryMuscle)
  );
  
  if (filtered.length === 0) {
    throw new ExerciseSelectionError(
      `No exercises found for muscle groups: ${primaryMuscles.join(', ')}`
    );
  }
  
  if (filtered.length < count) {
    console.warn(
      `Only ${filtered.length} exercises available for ${primaryMuscles.join(', ')}, ` +
      `requested ${count}. Returning all available.`
    );
  }
  
  const shuffled = shuffleArray(filtered);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}