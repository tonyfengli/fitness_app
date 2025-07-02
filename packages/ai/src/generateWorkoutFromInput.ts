import { createWorkoutGraph } from "./graph";
import type { WorkoutRoutineStateType } from "./types";
import { WorkoutGenerationError } from "./nodes/generateWorkoutNode";

/**
 * Generates a workout plan from user input
 * This is the main API-ready function that can be integrated with tRPC or Supabase functions
 * 
 * @param input - User's workout request (e.g., "I want to build muscle at home")
 * @returns Promise<WorkoutRoutineStateType> - The generated workout with plan and exercises
 * @throws {WorkoutGenerationError} If workout generation fails
 * 
 * @example
 * ```typescript
 * const result = await generateWorkoutFromInput("I want to lose weight with dumbbells");
 * console.log(result.programmedRoutine); // Formatted workout plan
 * console.log(result.exercises);   // Array of selected exercises
 * ```
 */
export async function generateWorkoutFromInput(input: string): Promise<WorkoutRoutineStateType> {
  if (!input || typeof input !== 'string') {
    throw new WorkoutGenerationError('Invalid input: must provide a non-empty string');
  }
  
  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    throw new WorkoutGenerationError('Invalid input: must provide a non-empty string');
  }
  
  try {
    const app = createWorkoutGraph();
    
    const result = await app.invoke({
      userInput: trimmedInput,
      programmedRoutine: "",
      exercises: [],
    });
    
    // Validate the result
    if (!result.programmedRoutine || result.programmedRoutine.length === 0) {
      throw new WorkoutGenerationError('Failed to generate workout plan');
    }
    
    if (!result.exercises || result.exercises.length === 0) {
      throw new WorkoutGenerationError('No exercises selected for workout');
    }
    
    return result;
  } catch (error) {
    // Re-throw WorkoutGenerationError as-is
    if (error instanceof WorkoutGenerationError) {
      throw error;
    }
    
    // Wrap any other errors
    throw new WorkoutGenerationError(
      'Failed to generate workout from input',
      error
    );
  }
}