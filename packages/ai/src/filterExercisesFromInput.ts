import { createFilterGraph } from "./graph";
import { fetchAllExercises, fetchExercisesByBusiness } from "./utils/fetchExercises";
import type { WorkoutRoutineStateType, ClientContext, RoutineTemplate } from "./types";
import { ExerciseFilterError } from "./nodes/rulesBasedFilterNode";
import { createDefaultClientContext } from "./types/clientContext";

export interface FilterExercisesOptions {
  userInput?: string;
  clientContext?: ClientContext;
  routineTemplate?: RoutineTemplate;
}

/**
 * Filters exercises based on client context and optional user input
 * This is the main API-ready function for exercise filtering
 * 
 * @param options - Object containing client context, user input, or legacy filter criteria
 * @returns Promise<WorkoutRoutineStateType> - The filtered exercises
 * @throws {ExerciseFilterError} If filtering fails
 * 
 * @example
 * ```typescript
 * const result = await filterExercisesFromInput({
 *   clientContext: {
 *     name: "John Doe",
 *     fitness_profile: {
 *       strength_capacity: "moderate",
 *       skill_capacity: "low"
 *     }
 *   },
 *   userInput: "I want to work out today"
 * });
 * console.log(result.filteredExercises); // Array of filtered exercises
 * ```
 */
export async function filterExercisesFromInput(options: FilterExercisesOptions): Promise<WorkoutRoutineStateType> {
  try {
    console.log('🚀 filterExercisesFromInput called');
    const { userInput = "", clientContext, routineTemplate } = options;
    
    // Determine which exercises to fetch based on business context
    let allExercises;
    
    if (clientContext?.business_id) {
      // Fetch business-specific exercises
      allExercises = await fetchExercisesByBusiness(clientContext.business_id);
    } else {
      // Fallback to all exercises if no business context
      allExercises = await fetchAllExercises();
    }
    
    if (!allExercises || allExercises.length === 0) {
      throw new ExerciseFilterError('No exercises available for this business');
    }
    
    // Handle client context or use defaults
    const finalClientContext: ClientContext = clientContext || createDefaultClientContext();
    
    // Create the filter graph
    const app = createFilterGraph();
    
    // Prepare initial state
    const initialState = {
      userInput: userInput.trim(),
      programmedRoutine: "",
      exercises: allExercises,
      clientContext: finalClientContext,
      filteredExercises: [],
      routineTemplate: routineTemplate || {
        routine_goal: "mixed_focus",
        muscle_target: [],
        routine_intensity: "moderate_local"
      }
    };
    
    // Run the filtering workflow with client context and routine template
    const result = await app.invoke(initialState);
    
    // Validate the result
    if (!result.filteredExercises) {
      throw new ExerciseFilterError('Failed to filter exercises');
    }
    
    return result;
  } catch (error) {
    // Re-throw ExerciseFilterError as-is
    if (error instanceof ExerciseFilterError) {
      throw error;
    }
    
    // Log unexpected errors
    console.error('❌ Unexpected error in filterExercisesFromInput:', error);
    
    // Wrap any other errors
    throw new ExerciseFilterError(
      'Failed to filter exercises from input',
      error
    );
  }
}